import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEPLOY_OUT_DIR = 'deploy';

/** Shiki themes actually referenced by src/lib/render-mdx.tsx */
export const SHIKI_KEEP_THEMES = new Set(['one-dark-pro']);

/**
 * Curated Shiki languages for scientific, mathematical, systems, and web publishing.
 * Transitive grammar imports (e.g. mdx -> markdown, html -> css/js) are preserved automatically.
 */
export const SHIKI_KEEP_LANGS = new Set([
  'asm',
  'bash',
  'c',
  'cmake',
  'cpp',
  'css',
  'csv',
  'diff',
  'docker',
  'fortran-free-form',
  'glsl',
  'go',
  'graphql',
  'haskell',
  'html',
  'http',
  'ini',
  'java',
  'javascript',
  'json',
  'jsonc',
  'jsx',
  'julia',
  'latex',
  'make',
  'markdown',
  'matlab',
  'mdx',
  'nginx',
  'plaintext',
  'python',
  'r',
  'regex',
  'rust',
  'shellscript',
  'shellsession',
  'sql',
  'tex',
  'toml',
  'tsx',
  'typescript',
  'verilog',
  'wasm',
  'wgsl',
  'xml',
  'yaml',
]);

/** Dev-only or runtime-writable files in public/ excluded from the git deploy artifact. */
export const PUBLIC_EXCLUDE_NAMES = new Set(['__dir-preview.html', 'uploads']);

/** Documentation filenames safe to strip inside standalone/node_modules. */
const STRIP_DOC_NAMES = new Set([
  'readme.md',
  'changelog.md',
  'history.md',
  'contributing.md',
  'security.md',
  'authors.md',
]);

/** Directories inside standalone/node_modules stripped from the slim git payload. */
const STRIP_NODE_MODULE_PATHS = [
  'next/node_modules/sharp',
  'sharp',
  '@img',
];

export function formatBytesMb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function buildDeployGitignore(): string {
  return [
    '/node_modules/',
    '/data/',
    '/tmp/',
    '/uploads/',
    '/standalone/public/uploads',
    '*.log',
    '/.env*',
    '!/.env.example',
    '',
  ].join('\n');
}

/**
 * Pure predicate identifying build/type/doc artifacts inside standalone/ that are
 * unnecessary at production runtime.
 */
export function shouldStripStandaloneFile(relPosixPath: string): boolean {
  const normalized = relPosixPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const lower = normalized.toLowerCase();
  const base = posix.basename(lower);

  if (
    lower.endsWith('.map') ||
    lower.endsWith('.d.ts') ||
    lower.endsWith('.d.mts') ||
    lower.endsWith('.d.cts') ||
    lower.endsWith('.tsbuildinfo')
  ) {
    return true;
  }

  // Never leak local .env files copied into .next/standalone
  if (base.startsWith('.env') && base !== '.env.example') {
    return true;
  }

  if (lower.startsWith('node_modules/') && STRIP_DOC_NAMES.has(base)) {
    return true;
  }

  return false;
}

export async function sizeOf(targetPath: string): Promise<number> {
  const info = await stat(targetPath);
  if (!info.isDirectory()) return info.size;
  const entries = await readdir(targetPath, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    total += await sizeOf(join(targetPath, entry.name));
  }
  return total;
}

async function stripUnneededFiles(dir: string, relPrefix = ''): Promise<number> {
  let removedBytes = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      removedBytes += await stripUnneededFiles(fullPath, relPath);
    } else if (shouldStripStandaloneFile(relPath)) {
      const info = await stat(fullPath);
      removedBytes += info.size;
      await rm(fullPath, { force: true });
    }
  }
  return removedBytes;
}

/**
 * Resolve transitive relative `.mjs` imports starting from seed filenames in a Shiki dist folder
 * so pruning never leaves a dangling grammar import.
 */
export async function resolveShikiClosure(distDir: string, seedIds: Set<string>): Promise<Set<string>> {
  const keep = new Set<string>();
  const queue: string[] = [];

  for (const id of seedIds) {
    const file = id.endsWith('.mjs') ? id : `${id}.mjs`;
    if (existsSync(join(distDir, file)) && !keep.has(file)) {
      keep.add(file);
      queue.push(file);
    }
  }

  const importPattern = /["']\.\/([^"']+\.mjs)["']/g;
  while (queue.length > 0) {
    const current = queue.shift()!;
    let content = '';
    try {
      content = await readFile(join(distDir, current), 'utf8');
    } catch {
      continue;
    }
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(content)) !== null) {
      const dep = match[1];
      if (!keep.has(dep) && existsSync(join(distDir, dep))) {
        keep.add(dep);
        queue.push(dep);
      }
    }
  }

  return keep;
}

export async function pruneShikiAssets(nodeModulesDir: string): Promise<{
  removedThemes: number;
  removedLangs: number;
  savedBytes: number;
}> {
  let removedThemes = 0;
  let removedLangs = 0;
  let savedBytes = 0;

  const themesDist = join(nodeModulesDir, '@shikijs', 'themes', 'dist');
  if (existsSync(themesDist)) {
    const keepThemes = await resolveShikiClosure(themesDist, SHIKI_KEEP_THEMES);
    const entries = await readdir(themesDist, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
      if (entry.name === 'index.mjs' || keepThemes.has(entry.name)) continue;
      const fullPath = join(themesDist, entry.name);
      const info = await stat(fullPath);
      savedBytes += info.size;
      removedThemes += 1;
      await rm(fullPath, { force: true });
    }
  }

  const langsDist = join(nodeModulesDir, '@shikijs', 'langs', 'dist');
  if (existsSync(langsDist)) {
    const keepLangs = await resolveShikiClosure(langsDist, SHIKI_KEEP_LANGS);
    const entries = await readdir(langsDist, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
      if (entry.name === 'index.mjs' || keepLangs.has(entry.name)) continue;
      const fullPath = join(langsDist, entry.name);
      const info = await stat(fullPath);
      savedBytes += info.size;
      removedLangs += 1;
      await rm(fullPath, { force: true });
    }
  }

  return { removedThemes, removedLangs, savedBytes };
}

async function copyPublicClean(srcPublic: string, destPublic: string): Promise<void> {
  await mkdir(destPublic, { recursive: true });
  if (!existsSync(srcPublic)) return;
  const entries = await readdir(srcPublic, { withFileTypes: true });
  for (const entry of entries) {
    if (PUBLIC_EXCLUDE_NAMES.has(entry.name)) continue;
    await cp(join(srcPublic, entry.name), join(destPublic, entry.name), { recursive: true });
  }
}

export async function assembleDeployDir(rootDir = process.cwd(), outDir = join(rootDir, DEPLOY_OUT_DIR)) {
  const standaloneSrc = join(rootDir, '.next', 'standalone');
  const staticSrc = join(rootDir, '.next', 'static');
  const standaloneServer = join(standaloneSrc, 'server.js');

  if (!existsSync(standaloneServer) || !existsSync(staticSrc)) {
    throw new Error(
      '.next/standalone/server.js or .next/static is missing. Run `NODE_ENV=production npm run build` first.'
    );
  }

  const runtimePkg = join(rootDir, 'package.runtime.json');
  if (!existsSync(runtimePkg)) {
    throw new Error('package.runtime.json is missing.');
  }

  const appEntry = join(rootDir, 'app.cjs');
  if (!existsSync(appEntry)) {
    throw new Error('app.cjs is missing.');
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // 1. Copy cPanel entrypoint & minimal runtime package.json
  await cp(appEntry, join(outDir, 'app.cjs'));
  await cp(runtimePkg, join(outDir, 'package.json'));

  if (existsSync(join(rootDir, '.env.example'))) {
    await cp(join(rootDir, '.env.example'), join(outDir, '.env.example'));
  }

  // 2. Copy SQL schema & cPanel finalize/install/seed helper scripts
  if (existsSync(join(rootDir, 'sql', 'schema.sql'))) {
    await mkdir(join(outDir, 'sql'), { recursive: true });
    await cp(join(rootDir, 'sql', 'schema.sql'), join(outDir, 'sql', 'schema.sql'));
  }

  await mkdir(join(outDir, 'scripts'), { recursive: true });
  for (const scriptName of [
    'cpanel-slim-finalize.sh',
    'cpanel-install.sh',
    'seed.mjs',
    'sample-articles.mjs',
  ]) {
    const srcScript = join(rootDir, 'scripts', scriptName);
    if (existsSync(srcScript)) {
      await cp(srcScript, join(outDir, 'scripts', scriptName));
    }
  }

  // 3. Copy Next.js standalone runtime, static assets, and clean public/
  const standaloneDest = join(outDir, 'standalone');
  await cp(standaloneSrc, standaloneDest, { recursive: true });
  await rm(join(standaloneDest, '.next', 'cache'), { recursive: true, force: true });
  await cp(staticSrc, join(standaloneDest, '.next', 'static'), { recursive: true });
  await rm(join(standaloneDest, 'public'), { recursive: true, force: true });
  await copyPublicClean(join(rootDir, 'public'), join(standaloneDest, 'public'));

  // 4. Prune heavy/duplicate native binaries & unused Shiki grammars/themes
  let savedBytes = 0;
  const standaloneNodeModules = join(standaloneDest, 'node_modules');
  for (const relMod of STRIP_NODE_MODULE_PATHS) {
    const modPath = join(standaloneNodeModules, relMod);
    if (existsSync(modPath)) {
      savedBytes += await sizeOf(modPath);
      await rm(modPath, { recursive: true, force: true });
    }
  }

  const dotNextNodeModules = join(standaloneDest, '.next', 'node_modules');
  if (existsSync(dotNextNodeModules)) {
    const linkEntries = await readdir(dotNextNodeModules, { withFileTypes: true });
    for (const entry of linkEntries) {
      if (entry.name === 'sharp' || entry.name.startsWith('sharp-')) {
        await rm(join(dotNextNodeModules, entry.name), { recursive: true, force: true });
      }
    }
  }

  const shikiStats = await pruneShikiAssets(standaloneNodeModules);
  savedBytes += shikiStats.savedBytes;
  savedBytes += await stripUnneededFiles(standaloneDest);

  // 5. Write .gitignore and DEPLOY.md for the deploy branch
  await writeFile(join(outDir, '.gitignore'), buildDeployGitignore(), 'utf8');
  await writeFile(
    join(outDir, 'DEPLOY.md'),
    [
      '# Slim Prebuilt Deployment Package (Scienta)',
      '',
      'Built outside cPanel so heavy build tools (`typescript`, `tailwindcss`, `eslint`, `.next/cache`, dev `node_modules`) never touch host disk quota.',
      '',
      '## Setup / Update on cPanel Terminal',
      '```bash',
      'bash scripts/cpanel-slim-finalize.sh',
      '```',
      '',
      'In **cPanel -> Setup Node.js App**:',
      '- Application startup file: `app.cjs`',
      '- Application mode: `Production`',
      '- Node.js version: `22` (recommended for built-in SQLite fallback)',
      '- Required `.env` keys: `NODE_ENV=production`, `JWT_SECRET` (32+ chars), optional MySQL (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) or automatic SQLite (`SQLITE_FALLBACK_PATH=data/scienta.sqlite`).',
      '',
    ].join('\n'),
    'utf8'
  );

  // 6. Stamp commit SHA last so stale packages can never be accidentally pushed
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (sha) {
      await writeFile(join(outDir, 'BUILD_SHA'), `${sha}\n`, 'utf8');
    }
  } catch {
    // Non-git workspace fallback
  }

  const nextBytes = await sizeOf(join(standaloneDest, '.next'));
  const nodeModulesBytes = existsSync(standaloneNodeModules) ? await sizeOf(standaloneNodeModules) : 0;
  const totalBytes = await sizeOf(outDir);

  return {
    outDir,
    nextBytes,
    nodeModulesBytes,
    totalBytes,
    savedBytes,
    shikiStats,
  };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  assembleDeployDir()
    .then(({ nextBytes, nodeModulesBytes, totalBytes, savedBytes, shikiStats }) => {
      console.log(`packaged ./${DEPLOY_OUT_DIR}`);
      console.log(`  app.cjs                  present`);
      console.log(`  standalone/.next         ${formatBytesMb(nextBytes)}`);
      console.log(`  standalone/node_modules  ${formatBytesMb(nodeModulesBytes)}`);
      console.log(
        `  pruned bloat             -${formatBytesMb(savedBytes)} (${shikiStats.removedThemes} shiki themes, ${shikiStats.removedLangs} langs, native sharp)`
      );
      console.log(`  total payload            ${formatBytesMb(totalBytes)}`);
      console.log(`\nRun \`npm run deploy:push\` (or push via CI) to publish to origin/deploy.`);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
