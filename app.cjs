/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { Readable, Writable } = require('node:stream');

// Entry point for cPanel "Setup Node.js App" (Phusion Passenger / LiteSpeed lsnode).
// Keeps relative paths (.env, data/, tmp/, uploads/, standalone/) rooted here and
// ensures production mode even if cPanel defaults NODE_ENV=development.
const APP_ROOT = __dirname;
process.chdir(APP_ROOT);
process.env.NODE_ENV = 'production';
// Keep native thread pools & glibc arenas lean on CloudLinux / cPanel shared hosts
// (prevents libuv, libvips/sharp, and glibc from spawning 32–64 threads on high-core hosts).
if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = '2';
}
if (!process.env.VIPS_CONCURRENCY) {
  process.env.VIPS_CONCURRENCY = '1';
}
if (!process.env.OMP_NUM_THREADS) {
  process.env.OMP_NUM_THREADS = '1';
}
if (!process.env.MALLOC_ARENA_MAX) {
  process.env.MALLOC_ARENA_MAX = '2';
}

// Under LiteSpeed `lsnode`, FD 0 (stdin) is already bound to LiteSpeed's LSAPI
// listening socket. When ESM dependencies such as `vfile` (used by `next-mdx-remote`)
// run `import process from 'node:process'`, Node evaluates the lazy `process.stdin`
// getter and libuv throws `Error: open EEXIST`. Probe each stdio descriptor once at
// boot and replace only broken descriptors with a harmless no-op stream.
(function guardBrokenStdio() {
  const fallbacks = {
    stdin: () => new Readable({ read() { this.push(null); } }),
    stdout: () => new Writable({ write(_chunk, _enc, cb) { cb(); } }),
    stderr: () => new Writable({ write(_chunk, _enc, cb) { cb(); } }),
  };
  for (const key of ['stdin', 'stdout', 'stderr']) {
    try {
      void process[key];
    } catch {
      Object.defineProperty(process, key, {
        value: fallbacks[key](),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
})();

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function writeBootError(label, err) {
  try {
    fs.mkdirSync(path.join(APP_ROOT, 'tmp'), { recursive: true });
    const message = `[${new Date().toISOString()}] ${label} (Node ${process.version}):\n${
      err && err.stack ? err.stack : String(err)
    }\n\n`;
    fs.appendFileSync(path.join(APP_ROOT, 'tmp', 'startup-error.log'), message);
  } catch {
    // Ignore log write failure
  }
  console.error(err);
}

process.on('uncaughtException', (err) => {
  writeBootError('uncaughtException', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  writeBootError('unhandledRejection', err);
  process.exit(1);
});

try {
  loadDotEnv(path.join(APP_ROOT, '.env'));

  // Persist built-in SQLite fallback inside data/ when MySQL is not configured,
  // avoiding shared-host /tmp cleanup on server reboot.
  if (!process.env.SQLITE_FALLBACK_PATH) {
    fs.mkdirSync(path.join(APP_ROOT, 'data'), { recursive: true });
    process.env.SQLITE_FALLBACK_PATH = path.join(APP_ROOT, 'data', 'scienta.sqlite');
  } else if (!path.isAbsolute(process.env.SQLITE_FALLBACK_PATH)) {
    const resolvedSqlite = path.resolve(APP_ROOT, process.env.SQLITE_FALLBACK_PATH);
    fs.mkdirSync(path.dirname(resolvedSqlite), { recursive: true });
    process.env.SQLITE_FALLBACK_PATH = resolvedSqlite;
  }

  // Expose root node_modules (including CloudLinux nodevenv symlink where host-native
  // `sharp` is installed) to the prebuilt Next.js standalone server.
  const rootNodeModules = path.join(APP_ROOT, 'node_modules');
  const existingNodePath = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  if (!existingNodePath.includes(rootNodeModules)) {
    process.env.NODE_PATH = [rootNodeModules, ...existingNodePath].filter(Boolean).join(path.delimiter);
    if (typeof Module._initPaths === 'function') {
      Module._initPaths();
    }
  }

  const standaloneServer = path.join(APP_ROOT, 'standalone', 'server.js');
  const fallbackServer = path.join(APP_ROOT, 'server.js');
  const entry = fs.existsSync(standaloneServer) ? standaloneServer : fallbackServer;

  if (!fs.existsSync(entry)) {
    throw new Error(
      `Next.js standalone server not found at ${standaloneServer}. Run \`npm run deploy:package\` first.`
    );
  }

  require(entry);
} catch (err) {
  writeBootError('Startup failure', err);
  process.exit(1);
}
