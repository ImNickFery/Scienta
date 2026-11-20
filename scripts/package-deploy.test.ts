import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assembleDeployDir,
  buildDeployGitignore,
  formatBytesMb,
  resolveShikiClosure,
  shouldStripStandaloneFile,
} from './package-deploy';

test('formatBytesMb formats byte counts cleanly', () => {
  assert.equal(formatBytesMb(1048576), '1.00 MB');
  assert.equal(formatBytesMb(1572864), '1.50 MB');
});

test('buildDeployGitignore anchors root runtime dirs so standalone/node_modules is never ignored', () => {
  const ignore = buildDeployGitignore();
  assert.match(ignore, /^\/node_modules\/$/m);
  assert.match(ignore, /^\/data\/$/m);
  assert.match(ignore, /^\/tmp\/$/m);
  assert.match(ignore, /^\/uploads\/$/m);
  assert.match(ignore, /^\/standalone\/public\/uploads$/m);
  assert.match(ignore, /^\/\.env\*$/m);
  assert.match(ignore, /^!\/\.env\.example$/m);
});

test('shouldStripStandaloneFile identifies sourcemaps, type defs, env leaks, and node_modules docs', () => {
  assert.equal(shouldStripStandaloneFile('.next/server/app/page.js.map'), true);
  assert.equal(shouldStripStandaloneFile('node_modules/postcss/lib/postcss.d.mts'), true);
  assert.equal(shouldStripStandaloneFile('node_modules/foo/README.md'), true);
  assert.equal(shouldStripStandaloneFile('.env.local'), true);
  assert.equal(shouldStripStandaloneFile('.env.example'), false);
  assert.equal(shouldStripStandaloneFile('server.js'), false);
  assert.equal(shouldStripStandaloneFile('node_modules/next/dist/server/next.js'), false);
});

test('resolveShikiClosure preserves transitive sibling grammar imports', async () => {
  const tmpDist = await fs.mkdtemp(path.join(os.tmpdir(), 'shiki-closure-'));
  try {
    await fs.writeFile(path.join(tmpDist, 'mdx.mjs'), `import md from "./markdown.mjs"; export default [md];`);
    await fs.writeFile(path.join(tmpDist, 'markdown.mjs'), `import h from "./html-derivative.mjs"; export default [h];`);
    await fs.writeFile(path.join(tmpDist, 'html-derivative.mjs'), `export default [];`);
    await fs.writeFile(path.join(tmpDist, 'cobol.mjs'), `export default [];`);

    const keep = await resolveShikiClosure(tmpDist, new Set(['mdx']));
    assert.ok(keep.has('mdx.mjs'));
    assert.ok(keep.has('markdown.mjs'));
    assert.ok(keep.has('html-derivative.mjs'));
    assert.ok(!keep.has('cobol.mjs'));
  } finally {
    await fs.rm(tmpDist, { recursive: true, force: true });
  }
});

test('assembleDeployDir packages Next.js standalone, strips bloat/sharp, prunes shiki, and cleans public', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'scienta-pkg-test-'));
  try {
    // Build minimal fixture matching Next.js 16 standalone layout
    await fs.mkdir(path.join(tmpRoot, '.next', 'standalone', '.next', 'server'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, '.next', 'standalone', '.next', 'cache'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, '.next', 'standalone', 'node_modules', 'next', 'node_modules', 'sharp'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tmpRoot, '.next', 'standalone', 'node_modules', 'sharp'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@img', 'sharp-linux-x64'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@shikijs', 'themes', 'dist'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@shikijs', 'langs', 'dist'), {
      recursive: true,
    });
    await fs.mkdir(path.join(tmpRoot, '.next', 'static', 'chunks'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'public', 'uploads', 'media'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'sql'), { recursive: true });

    await fs.writeFile(path.join(tmpRoot, 'app.cjs'), "require('./standalone/server.js');\n");
    await fs.writeFile(
      path.join(tmpRoot, 'package.runtime.json'),
      '{"name":"scienta-app","optionalDependencies":{"sharp":"^0.35.3"}}'
    );
    await fs.writeFile(path.join(tmpRoot, '.env.example'), 'JWT_SECRET=\n');
    await fs.writeFile(path.join(tmpRoot, 'sql', 'schema.sql'), 'CREATE TABLE test (id INT);\n');
    await fs.writeFile(path.join(tmpRoot, 'scripts', 'cpanel-slim-finalize.sh'), '#!/usr/bin/env bash\n');
    await fs.writeFile(path.join(tmpRoot, '.next', 'standalone', 'server.js'), 'console.log("ok");\n');
    await fs.writeFile(path.join(tmpRoot, '.next', 'standalone', '.env.local'), 'SECRET=leak\n');
    await fs.writeFile(path.join(tmpRoot, '.next', 'standalone', '.next', 'server', 'route.js'), '1');
    await fs.writeFile(path.join(tmpRoot, '.next', 'standalone', '.next', 'server', 'route.js.map'), '{}');
    await fs.writeFile(path.join(tmpRoot, '.next', 'standalone', '.next', 'cache', 'x.bin'), 'cache');
    await fs.writeFile(
      path.join(tmpRoot, '.next', 'standalone', 'node_modules', 'next', 'node_modules', 'sharp', 'libvips.so'),
      '0'.repeat(1024)
    );
    await fs.writeFile(
      path.join(tmpRoot, '.next', 'standalone', 'node_modules', 'sharp', 'index.js'),
      'module.exports = {};'
    );
    await fs.writeFile(
      path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@img', 'sharp-linux-x64', 'bin.node'),
      'binary'
    );
    await fs.writeFile(
      path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@shikijs', 'themes', 'dist', 'one-dark-pro.mjs'),
      'export default {};'
    );
    await fs.writeFile(
      path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@shikijs', 'themes', 'dist', 'dracula.mjs'),
      'export default {};'
    );
    await fs.writeFile(
      path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@shikijs', 'langs', 'dist', 'python.mjs'),
      'export default [];'
    );
    await fs.writeFile(
      path.join(tmpRoot, '.next', 'standalone', 'node_modules', '@shikijs', 'langs', 'dist', 'abap.mjs'),
      'export default [];'
    );
    await fs.writeFile(path.join(tmpRoot, '.next', 'static', 'chunks', 'main.js'), 'console.log(1);');
    await fs.writeFile(path.join(tmpRoot, 'public', 'logo.svg'), '<svg/>');
    await fs.writeFile(path.join(tmpRoot, 'public', '__dir-preview.html'), '<html>debug</html>');
    await fs.writeFile(path.join(tmpRoot, 'public', 'uploads', 'media', 'test.png'), 'img');

    const res = await assembleDeployDir(tmpRoot);
    const outFiles = await fs.readdir(res.outDir);

    assert.ok(outFiles.includes('app.cjs'));
    assert.ok(outFiles.includes('package.json'));
    assert.ok(outFiles.includes('.gitignore'));
    assert.ok(outFiles.includes('.env.example'));
    assert.ok(outFiles.includes('DEPLOY.md'));
    assert.ok(outFiles.includes('standalone'));
    assert.ok(outFiles.includes('sql'));
    assert.ok(!outFiles.includes('src'));

    const pkgJson = await fs.readFile(path.join(res.outDir, 'package.json'), 'utf8');
    assert.match(pkgJson, /"sharp"/);

    // Static assets copied, cache & sourcemaps & .env.local stripped
    const staticChunks = await fs.readdir(path.join(res.outDir, 'standalone', '.next', 'static', 'chunks'));
    assert.ok(staticChunks.includes('main.js'));
    const serverFiles = await fs.readdir(path.join(res.outDir, 'standalone', '.next', 'server'));
    assert.ok(!serverFiles.includes('route.js.map'));
    const standaloneTop = await fs.readdir(path.join(res.outDir, 'standalone'));
    assert.ok(!standaloneTop.includes('.env.local'));
    const standaloneDotNext = await fs.readdir(path.join(res.outDir, 'standalone', '.next'));
    assert.ok(!standaloneDotNext.includes('cache'));

    // Public cleaned of __dir-preview.html and uploads/
    const publicFiles = await fs.readdir(path.join(res.outDir, 'standalone', 'public'));
    assert.ok(publicFiles.includes('logo.svg'));
    assert.ok(!publicFiles.includes('__dir-preview.html'));
    assert.ok(!publicFiles.includes('uploads'));

    // Native sharp / @img stripped from standalone/node_modules
    const nmEntries = await fs.readdir(path.join(res.outDir, 'standalone', 'node_modules'));
    assert.ok(!nmEntries.includes('sharp'));
    assert.ok(!nmEntries.includes('@img'));
    const nextNmEntries = await fs.readdir(path.join(res.outDir, 'standalone', 'node_modules', 'next', 'node_modules'));
    assert.ok(!nextNmEntries.includes('sharp'));

    // Shiki pruned cleanly
    const themeFiles = await fs.readdir(
      path.join(res.outDir, 'standalone', 'node_modules', '@shikijs', 'themes', 'dist')
    );
    assert.deepEqual(themeFiles, ['one-dark-pro.mjs']);

    const langFiles = await fs.readdir(
      path.join(res.outDir, 'standalone', 'node_modules', '@shikijs', 'langs', 'dist')
    );
    assert.deepEqual(langFiles, ['python.mjs']);
    assert.equal(res.shikiStats.removedThemes, 1);
    assert.equal(res.shikiStats.removedLangs, 1);
    assert.ok(res.savedBytes > 1024);

    // Verify git add -A actually tracks standalone/node_modules while ignoring root runtime dirs
    await fs.writeFile(
      path.join(res.outDir, 'standalone', 'node_modules', 'next', 'package.json'),
      '{"name":"next"}'
    );
    await fs.mkdir(path.join(res.outDir, 'node_modules', 'sharp'), { recursive: true });
    await fs.writeFile(path.join(res.outDir, 'node_modules', 'sharp', 'index.js'), '');
    await fs.writeFile(path.join(res.outDir, '.env'), 'JWT_SECRET=secret\n');
    execFileSync('git', ['init', '-q'], { cwd: res.outDir });
    execFileSync('git', ['add', '-A'], { cwd: res.outDir });
    const staged = execFileSync('git', ['ls-files'], { cwd: res.outDir, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    assert.ok(staged.includes('standalone/node_modules/next/package.json'));
    assert.ok(staged.includes('.env.example'));
    assert.ok(!staged.includes('node_modules/sharp/index.js'));
    assert.ok(!staged.includes('.env'));
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});
