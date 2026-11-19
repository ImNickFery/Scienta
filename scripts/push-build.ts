/**
 * Publishes the prebuilt ./deploy folder as a single-commit force-pushed `deploy` branch.
 *
 *   npm run deploy:push
 *
 * Single-commit `deploy` branch architecture:
 * - Heavy builds (Next.js compilation, TypeScript, Tailwind, ~1.1 GB dev artifacts) run
 *   on GitHub Actions or locally — NEVER on low-quota cPanel shared hosting.
 * - cPanel connects to the GitHub repo with a read-only SSH Deploy Key, pulls only the
 *   slim `deploy` branch, and runs `bash scripts/cpanel-slim-finalize.sh`.
 * - Single-commit force-push ensures the `deploy` branch never accumulates old build history.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';

const DEPLOY_DIR = 'deploy';
const BRANCH = 'deploy';

const git = (args: string[], cwd?: string) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (!existsSync(DEPLOY_DIR) || !existsSync(`${DEPLOY_DIR}/standalone/server.js`)) {
  console.error(
    'No packaged build found. Run `NODE_ENV=production npm run build && npm run deploy:package` first.'
  );
  process.exit(1);
}

const rawDirty = git(['status', '--porcelain']);
const dirtyLines = rawDirty
  .split('\n')
  .filter(Boolean)
  .filter((line) => {
    if (process.env.CI !== 'true') return true;
    const file = line.slice(3).trim();
    return file !== 'package-lock.json' && file !== 'bun.lock';
  });

if (dirtyLines.length > 0) {
  console.error('The working tree has uncommitted changes:\n');
  console.error(
    dirtyLines
      .slice(0, 10)
      .map((line) => `  ${line}`)
      .join('\n')
  );
  console.error('\nCommit them first so the build matches a real commit.');
  process.exit(1);
}

const sha = git(['rev-parse', '--short', 'HEAD']);
const subject = git(['log', '-1', '--format=%s']);
const remote = git(['remote', 'get-url', 'origin']);

const stampFile = `${DEPLOY_DIR}/BUILD_SHA`;
const stamped = existsSync(stampFile) ? readFileSync(stampFile, 'utf8').trim() : null;
const head = git(['rev-parse', 'HEAD']);
if (stamped !== head) {
  console.error(
    stamped === null
      ? `${stampFile} is missing — rebuild cleanly first.`
      : `./${DEPLOY_DIR} was built from ${stamped.slice(0, 7)}, but HEAD is ${sha}.`
  );
  console.error('\nRun `npm run deploy:push` to build, package, and push together.');
  process.exit(1);
}

console.log(`packaging ${sha} — ${subject}`);

let extraHeader = '';
try {
  extraHeader = git(['config', '--get', 'http.https://github.com/.extraheader']);
} catch {
  // Not present on local SSH/GCM checkouts
}

let pushRemote = remote;
if (!extraHeader && process.env.GITHUB_TOKEN && remote.startsWith('https://github.com/')) {
  pushRemote = remote.replace(
    'https://github.com/',
    `https://x-access-token:${process.env.GITHUB_TOKEN}@`
  );
}

rmSync(`${DEPLOY_DIR}/.git`, { recursive: true, force: true });
git(['init', '-q', '-b', BRANCH], DEPLOY_DIR);
git(['remote', 'add', 'origin', pushRemote], DEPLOY_DIR);
if (extraHeader) {
  git(['config', 'http.https://github.com/.extraheader', extraHeader], DEPLOY_DIR);
}
git(['add', '-A'], DEPLOY_DIR);
git(
  [
    '-c',
    'user.name=scienta-deploy',
    '-c',
    'user.email=deploy@localhost',
    'commit',
    '-q',
    '-m',
    `Build of ${sha} — ${subject}`,
  ],
  DEPLOY_DIR
);

const fileCount = git(['ls-files'], DEPLOY_DIR).split('\n').filter(Boolean).length;
console.log(`pushing ${fileCount} slim runtime files to origin/${BRANCH}...`);

execFileSync('git', ['push', '--force', 'origin', `${BRANCH}:${BRANCH}`], {
  cwd: DEPLOY_DIR,
  stdio: 'inherit',
});

console.log(
  `done. On cPanel Terminal, run:
  cd ~/scienta-app && git fetch --depth 1 origin ${BRANCH} && git reset --hard origin/${BRANCH} && bash scripts/cpanel-slim-finalize.sh`
);
