import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { execute, queryOne } from "./db";
import { runDatabaseMaintenance } from "./db-optimizer";
import {
  DEFAULT_UPDATER_CONFIG,
  generateOpenSshEd25519Keypair,
  sanitizeDeployLogLine,
  validateGitBranch,
  validateGithubRepoUrl,
  type DeployJobRecord,
  type DeployStep,
  type RepoVisibility,
  type UpdaterConfig,
} from "./system-updater-core";

const execFileAsync = promisify(execFile);

const UPDATER_CONFIG_KEY = "system_updater_config";
const DEPLOY_HISTORY_KEY = "system_deploy_history";
const MAX_LOG_LINES = 300;
const MAX_HISTORY_ENTRIES = 12;

export interface SshKeyPublicStatus {
  exists: boolean;
  algorithm: "ed25519" | null;
  publicKey: string | null;
  fingerprintSha256: string | null;
  comment: string | null;
  createdAt: string | null;
  sshBinaryAvailable: boolean;
  gitBinaryAvailable: boolean;
}

export interface LocalGitStatus {
  isGitRepo: boolean;
  currentBranch: string | null;
  currentCommit: string | null;
  currentCommitShort: string | null;
  currentCommitMessage: string | null;
  currentCommitDate: string | null;
  remoteOriginUrl: string | null;
  dirtyFilesCount: number;
}

export interface UpdateCheckResult {
  reachable: boolean;
  repoUrl: string;
  branch: string;
  visibility: RepoVisibility;
  localCommit: string | null;
  remoteCommit: string | null;
  remoteCommitShort: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  message: string;
  error?: string;
}

declare global {
  var __scientaActiveDeployJob: DeployJobRecord | undefined;
}

function getSshBaseDir(): string {
  const raw = process.env.SCIENTA_SSH_DIR?.trim();
  return path.resolve(/*turbopackIgnore: true*/ raw || "/tmp/scienta-ssh");
}

function resolveConfinedSshFile(filename: string): string {
  const baseDir = getSshBaseDir();
  const resolved = path.resolve(/*turbopackIgnore: true*/ baseDir, filename);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new Error("Invalid SSH key storage path.");
  }
  return resolved;
}

const binaryAvailabilityCache = new Map<string, boolean>();

async function isBinaryAvailable(binary: "git" | "ssh" | "npm"): Promise<boolean> {
  const cached = binaryAvailabilityCache.get(binary);
  if (cached !== undefined) return cached;
  try {
    await execFileAsync("which", [binary], { timeout: 2500 });
    binaryAvailabilityCache.set(binary, true);
    return true;
  } catch {
    binaryAvailabilityCache.set(binary, false);
    return false;
  }
}

function computeFingerprintFromPublicKeyLine(pubLine: string): string | null {
  const parts = pubLine.trim().split(/\s+/);
  if (parts.length < 2) return null;
  try {
    const blob = Buffer.from(parts[1], "base64");
    const hash = crypto.createHash("sha256").update(blob).digest("base64").replace(/=+$/g, "");
    return `SHA256:${hash}`;
  } catch {
    return null;
  }
}

/**
 * Returns non-sensitive metadata for the server's SSH Deploy Keypair.
 * NEVER exposes the private key or filesystem path.
 */
export async function getSshKeyStatus(): Promise<SshKeyPublicStatus> {
  const [sshBinaryAvailable, gitBinaryAvailable] = await Promise.all([
    isBinaryAvailable("ssh"),
    isBinaryAvailable("git"),
  ]);

  try {
    const privPath = resolveConfinedSshFile("id_ed25519");
    const pubPath = resolveConfinedSshFile("id_ed25519.pub");
    if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
      return {
        exists: false,
        algorithm: null,
        publicKey: null,
        fingerprintSha256: null,
        comment: null,
        createdAt: null,
        sshBinaryAvailable,
        gitBinaryAvailable,
      };
    }

    const publicKey = fs.readFileSync(pubPath, "utf8").trim();
    const stat = fs.statSync(pubPath);
    const parts = publicKey.split(/\s+/);
    return {
      exists: true,
      algorithm: "ed25519",
      publicKey,
      fingerprintSha256: computeFingerprintFromPublicKeyLine(publicKey),
      comment: parts[2] || "scienta-panel-deploy",
      createdAt: stat.mtime.toISOString(),
      sshBinaryAvailable,
      gitBinaryAvailable,
    };
  } catch {
    return {
      exists: false,
      algorithm: null,
      publicKey: null,
      fingerprintSha256: null,
      comment: null,
      createdAt: null,
      sshBinaryAvailable,
      gitBinaryAvailable,
    };
  }
}

/**
 * Generates (or rotates) a fresh Ed25519 SSH Deploy Keypair on the server,
 * storing the private key with strict `0600` permissions and returning ONLY
 * the public key & SHA-256 fingerprint.
 */
export async function generateOrRotateSshDeployKey(
  comment: string = "scienta-panel-deploy"
): Promise<SshKeyPublicStatus> {
  const baseDir = getSshBaseDir();
  fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(baseDir, 0o700);
  } catch {
    // Ignore on filesystems that ignore POSIX chmod
  }

  const keypair = generateOpenSshEd25519Keypair(comment);
  const privPath = resolveConfinedSshFile("id_ed25519");
  const pubPath = resolveConfinedSshFile("id_ed25519.pub");

  // Write private key atomically with 0600 mode
  fs.writeFileSync(privPath, keypair.privateKey, { mode: 0o600, encoding: "utf8" });
  try {
    fs.chmodSync(privPath, 0o600);
  } catch {
    // Ignore if filesystem does not support chmod
  }
  fs.writeFileSync(pubPath, `${keypair.publicKey}\n`, { mode: 0o644, encoding: "utf8" });

  return getSshKeyStatus();
}

/**
 * Deletes the panel's stored SSH Deploy Keypair from disk.
 */
export async function deleteSshDeployKey(): Promise<SshKeyPublicStatus> {
  for (const name of ["id_ed25519", "id_ed25519.pub"]) {
    try {
      const target = resolveConfinedSshFile(name);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    } catch {
      // Ignore cleanup error
    }
  }
  return getSshKeyStatus();
}

async function readSettingJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await queryOne<{ value: string | null }>(
      "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
      [key]
    );
    if (!row?.value) return fallback;
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

async function writeSettingJson(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  const res = await execute(
    "UPDATE settings SET `value` = ?, updated_at = NOW() WHERE `key` = ?",
    [serialized, key]
  );
  if (!res.affectedRows) {
    await execute("INSERT INTO settings (`key`, `value`) VALUES (?, ?)", [key, serialized]);
  }
}

export async function getUpdaterConfig(): Promise<UpdaterConfig> {
  const stored = await readSettingJson<Partial<UpdaterConfig>>(UPDATER_CONFIG_KEY, {});
  return {
    ...DEFAULT_UPDATER_CONFIG,
    ...stored,
    visibility: stored.visibility === "private" ? "private" : "public",
    autoInstallDeps: stored.autoInstallDeps !== false,
    autoBuild: stored.autoBuild !== false,
    autoOptimizeDb: stored.autoOptimizeDb !== false,
  };
}

export async function saveUpdaterConfig(input: {
  repoUrl: string;
  branch: string;
  visibility: RepoVisibility;
  autoInstallDeps?: boolean;
  autoBuild?: boolean;
  autoOptimizeDb?: boolean;
}): Promise<{ ok: true; config: UpdaterConfig } | { ok: false; error: string }> {
  const repoCheck = validateGithubRepoUrl(input.repoUrl, input.visibility);
  if (!repoCheck.ok) {
    return { ok: false, error: repoCheck.error };
  }
  const branchCheck = validateGitBranch(input.branch);
  if (!branchCheck.ok) {
    return { ok: false, error: branchCheck.error };
  }

  const prev = await getUpdaterConfig();
  const next: UpdaterConfig = {
    ...prev,
    repoUrl: repoCheck.repo.normalizedUrl,
    branch: branchCheck.branch,
    visibility: repoCheck.repo.visibility,
    autoInstallDeps: input.autoInstallDeps ?? prev.autoInstallDeps,
    autoBuild: input.autoBuild ?? prev.autoBuild,
    autoOptimizeDb: input.autoOptimizeDb ?? prev.autoOptimizeDb,
    lastError: null,
  };

  await writeSettingJson(UPDATER_CONFIG_KEY, next);
  return { ok: true, config: next };
}

export async function getDeployHistory(): Promise<DeployJobRecord[]> {
  const history = await readSettingJson<DeployJobRecord[]>(DEPLOY_HISTORY_KEY, []);
  return Array.isArray(history) ? history.slice(0, MAX_HISTORY_ENTRIES) : [];
}

async function appendDeployHistory(job: DeployJobRecord): Promise<void> {
  const prev = await getDeployHistory();
  const compactJob: DeployJobRecord = {
    ...job,
    logs: job.logs.slice(-80),
  };
  const next = [compactJob, ...prev.filter((item) => item.id !== job.id)].slice(0, MAX_HISTORY_ENTRIES);
  await writeSettingJson(DEPLOY_HISTORY_KEY, next);
}

export function getActiveDeployJob(): DeployJobRecord | null {
  return globalThis.__scientaActiveDeployJob ?? null;
}

const LOCAL_GIT_CACHE_TTL_MS = 15_000;
let localGitStatusCache: { value: LocalGitStatus; expiresAt: number } | null = null;

export function invalidateLocalGitStatusCache(): void {
  localGitStatusCache = null;
}

/**
 * Parses `git status --porcelain --branch` output into active branch name and dirty entry count.
 */
export function parseGitStatusBranchAndDirty(output: string | null): {
  branch: string | null;
  dirtyFilesCount: number;
} {
  if (!output) return { branch: null, dirtyFilesCount: 0 };
  const lines = output.split(/\r?\n/).filter((l) => l.length > 0);
  let branch: string | null = null;
  let dirtyFilesCount = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const header = line.slice(3).trim();
      if (header.startsWith("HEAD (no branch)") || header.startsWith("No commits yet on ")) {
        const noCommitMatch = /^No commits yet on (.+)$/.exec(header);
        branch = noCommitMatch ? noCommitMatch[1].trim() : "HEAD";
      } else {
        const dotIdx = header.indexOf("...");
        branch = (dotIdx >= 0 ? header.slice(0, dotIdx) : header).trim() || null;
      }
    } else {
      dirtyFilesCount += 1;
    }
  }
  return { branch, dirtyFilesCount };
}

/**
 * Inspects local working tree Git metadata safely via sequential `execFile` calls (no shell)
 * with a 15-second in-memory TTL cache to avoid spiking CloudLinux NPROC limits.
 */
export async function getLocalGitStatus(forceRefresh = false): Promise<LocalGitStatus> {
  const now = Date.now();
  if (!forceRefresh && localGitStatusCache && localGitStatusCache.expiresAt > now) {
    return localGitStatusCache.value;
  }

  const cwd = process.cwd();
  if (!fs.existsSync(path.join(/*turbopackIgnore: true*/ cwd, ".git"))) {
    const empty: LocalGitStatus = {
      isGitRepo: false,
      currentBranch: null,
      currentCommit: null,
      currentCommitShort: null,
      currentCommitMessage: null,
      currentCommitDate: null,
      remoteOriginUrl: null,
      dirtyFilesCount: 0,
    };
    localGitStatusCache = { value: empty, expiresAt: now + LOCAL_GIT_CACHE_TTL_MS };
    return empty;
  }

  const runGit = async (args: string[]): Promise<string | null> => {
    try {
      const { stdout } = await execFileAsync("git", args, { cwd, timeout: 4000 });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  };

  // Run sequentially (never 6 concurrent forks) and coalesce commit hash + subject + date into 1 call
  const logLine = await runGit(["log", "-1", "--pretty=%H%x1f%s%x1f%cI"]);
  const [commitRaw, messageRaw, commitDateRaw] = logLine ? logLine.split("\x1f") : [];
  const statusOut = await runGit(["status", "--porcelain", "--branch"]);
  const originUrl = await runGit(["remote", "get-url", "origin"]);

  const { branch, dirtyFilesCount } = parseGitStatusBranchAndDirty(statusOut);
  const commit = commitRaw?.trim() || null;

  const result: LocalGitStatus = {
    isGitRepo: true,
    currentBranch: branch,
    currentCommit: commit,
    currentCommitShort: commit ? commit.slice(0, 8) : null,
    currentCommitMessage: messageRaw?.trim() ? sanitizeDeployLogLine(messageRaw.trim()) : null,
    currentCommitDate: commitDateRaw?.trim() || null,
    remoteOriginUrl: originUrl ? sanitizeDeployLogLine(originUrl) : null,
    dirtyFilesCount,
  };
  localGitStatusCache = { value: result, expiresAt: now + LOCAL_GIT_CACHE_TTL_MS };
  return result;
}

/**
 * Builds a hardened environment for `git` commands:
 * - Disables interactive credential prompts (`GIT_TERMINAL_PROMPT=0`)
 * - Uses the panel's server-side Ed25519 deploy key when pulling from a private repo
 */
function buildGitCommandEnv(visibility: RepoVisibility): {
  ok: true;
  env: NodeJS.ProcessEnv;
} | {
  ok: false;
  error: string;
} {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };

  if (visibility === "private") {
    const privPath = resolveConfinedSshFile("id_ed25519");
    if (!fs.existsSync(privPath)) {
      return {
        ok: false,
        error: "SSH Deploy Key has not been generated yet. Generate an SSH key first and add its public key to GitHub.",
      };
    }
    const knownHostsPath = resolveConfinedSshFile("known_hosts");
    // Construct GIT_SSH_COMMAND strictly from server-controlled internal paths (never user input)
    env.GIT_SSH_COMMAND = [
      "ssh",
      "-i",
      privPath,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      `UserKnownHostsFile=${knownHostsPath}`,
      "-o",
      "ConnectTimeout=15",
    ].join(" ");
  }

  return { ok: true, env };
}

/**
 * Tests connectivity to the configured GitHub repo (public HTTPS or private SSH)
 * and compares the remote branch HEAD commit against the local repository commit.
 */
export async function checkGithubForUpdates(override?: {
  repoUrl?: string;
  branch?: string;
  visibility?: RepoVisibility;
}): Promise<UpdateCheckResult> {
  const cfg = await getUpdaterConfig();
  const rawRepo = override?.repoUrl ?? cfg.repoUrl;
  const rawBranch = override?.branch ?? cfg.branch;
  const visibility = override?.visibility ?? cfg.visibility;
  const checkedAt = new Date().toISOString();

  const repoCheck = validateGithubRepoUrl(rawRepo, visibility);
  if (!repoCheck.ok) {
    return {
      reachable: false,
      repoUrl: rawRepo,
      branch: rawBranch,
      visibility,
      localCommit: null,
      remoteCommit: null,
      remoteCommitShort: null,
      updateAvailable: false,
      checkedAt,
      message: repoCheck.error,
      error: repoCheck.error,
    };
  }

  const branchCheck = validateGitBranch(rawBranch);
  if (!branchCheck.ok) {
    return {
      reachable: false,
      repoUrl: repoCheck.repo.normalizedUrl,
      branch: rawBranch,
      visibility: repoCheck.repo.visibility,
      localCommit: null,
      remoteCommit: null,
      remoteCommitShort: null,
      updateAvailable: false,
      checkedAt,
      message: branchCheck.error,
      error: branchCheck.error,
    };
  }

  if (repoCheck.repo.visibility === "private") {
    const hasSsh = await isBinaryAvailable("ssh");
    if (!hasSsh) {
      const msg =
        "OpenSSH client (`ssh`) is not installed on this host. Install `openssh-client` on your production server to connect via SSH Deploy Keys, or switch to a public HTTPS repository.";
      return {
        reachable: false,
        repoUrl: repoCheck.repo.normalizedUrl,
        branch: branchCheck.branch,
        visibility: repoCheck.repo.visibility,
        localCommit: null,
        remoteCommit: null,
        remoteCommitShort: null,
        updateAvailable: false,
        checkedAt,
        message: msg,
        error: msg,
      };
    }
  }

  const envResult = buildGitCommandEnv(repoCheck.repo.visibility);
  if (!envResult.ok) {
    return {
      reachable: false,
      repoUrl: repoCheck.repo.normalizedUrl,
      branch: branchCheck.branch,
      visibility: repoCheck.repo.visibility,
      localCommit: null,
      remoteCommit: null,
      remoteCommitShort: null,
      updateAvailable: false,
      checkedAt,
      message: envResult.error,
      error: envResult.error,
    };
  }

  const localGit = await getLocalGitStatus();

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-remote", "--heads", "--", repoCheck.repo.normalizedUrl, `refs/heads/${branchCheck.branch}`],
      {
        cwd: process.cwd(),
        env: envResult.env,
        timeout: 20_000,
        maxBuffer: 1024 * 1024,
      }
    );

    const firstLine = stdout.trim().split("\n").find(Boolean);
    if (!firstLine) {
      const errMsg = `Branch "${branchCheck.branch}" was not found on ${repoCheck.repo.owner}/${repoCheck.repo.repo}.`;
      return {
        reachable: true,
        repoUrl: repoCheck.repo.normalizedUrl,
        branch: branchCheck.branch,
        visibility: repoCheck.repo.visibility,
        localCommit: localGit.currentCommit,
        remoteCommit: null,
        remoteCommitShort: null,
        updateAvailable: false,
        checkedAt,
        message: errMsg,
        error: errMsg,
      };
    }

    const remoteCommit = firstLine.split(/\s+/)[0] || null;
    const updateAvailable = Boolean(remoteCommit && remoteCommit !== localGit.currentCommit);

    // Persist check metadata cleanly
    await writeSettingJson(UPDATER_CONFIG_KEY, {
      ...cfg,
      repoUrl: repoCheck.repo.normalizedUrl,
      branch: branchCheck.branch,
      visibility: repoCheck.repo.visibility,
      lastCheckedAt: checkedAt,
      lastRemoteCommit: remoteCommit,
      lastError: null,
    });

    return {
      reachable: true,
      repoUrl: repoCheck.repo.normalizedUrl,
      branch: branchCheck.branch,
      visibility: repoCheck.repo.visibility,
      localCommit: localGit.currentCommit,
      remoteCommit,
      remoteCommitShort: remoteCommit ? remoteCommit.slice(0, 8) : null,
      updateAvailable,
      checkedAt,
      message: updateAvailable
        ? "New version available on GitHub."
        : "Your server is already up to date with GitHub.",
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const cleanErr = sanitizeDeployLogLine(rawMsg);
    const friendly =
      cleanErr.includes("Permission denied (publickey)")
        ? "GitHub rejected the SSH key (Permission denied). Make sure you added this panel's Public Key under GitHub → Settings → Deploy keys."
        : cleanErr.includes("Repository not found")
          ? "Repository not found or access denied. Verify the URL and Deploy Key permissions."
          : cleanErr;

    await writeSettingJson(UPDATER_CONFIG_KEY, {
      ...cfg,
      lastCheckedAt: checkedAt,
      lastError: friendly,
    }).catch(() => {});

    return {
      reachable: false,
      repoUrl: repoCheck.repo.normalizedUrl,
      branch: branchCheck.branch,
      visibility: repoCheck.repo.visibility,
      localCommit: localGit.currentCommit,
      remoteCommit: null,
      remoteCommitShort: null,
      updateAvailable: false,
      checkedAt,
      message: friendly,
      error: friendly,
    };
  }
}

/**
 * Spawns a single non-shell command (`shell: false`) streaming sanitized lines into the active job log.
 */
function runStreamingCommand(
  cmd: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
  onLine: (line: string) => void
): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, opts.timeoutMs);

    const handleChunk = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const trimmed = rawLine.trimEnd();
        if (trimmed) onLine(trimmed);
      }
    };

    child.stdout?.on("data", handleChunk);
    child.stderr?.on("data", handleChunk);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${Math.round(opts.timeoutMs / 1000)}s`));
        return;
      }
      resolve({ code: code ?? 1 });
    });
  });
}

function createInitialSteps(cfg: UpdaterConfig): DeployStep[] {
  return [
    {
      id: "preflight",
      labelEn: "Verify Repository & SSH Credentials",
      labelFa: "بررسی مخزن گیت‌هاب و اعتبارسنجی SSH",
      status: "pending",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    },
    {
      id: "fetch",
      labelEn: "Fetch Latest Code from GitHub",
      labelFa: "دریافت آخرین نسخه از گیت‌هاب",
      status: "pending",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    },
    {
      id: "checkout",
      labelEn: "Apply Updated Release Commit",
      labelFa: "اعمال نسخه جدید روی سرور",
      status: "pending",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    },
    {
      id: "deps",
      labelEn: "Install Dependencies (npm install)",
      labelFa: "نصب و بروزرسانی وابستگی‌ها",
      status: cfg.autoInstallDeps ? "pending" : "skipped",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    },
    {
      id: "build",
      labelEn: "Compile Production Build (npm run build)",
      labelFa: "ساخت نسخه نهایی (Production Build)",
      status: cfg.autoBuild ? "pending" : "skipped",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    },
    {
      id: "db",
      labelEn: "Optimize Database Indexes & Statistics",
      labelFa: "بهینه‌سازی ایندکس‌ها و آمار دیتابیس",
      status: cfg.autoOptimizeDb ? "pending" : "skipped",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
    },
  ];
}

/**
 * Triggers an asynchronous, concurrency-locked GitHub site update pipeline.
 * Streams progress into `globalThis.__scientaActiveDeployJob` so the admin UI
 * receives live step updates and terminal output without blocking the HTTP response.
 */
export async function startSiteUpdateJob(triggeredBy: string): Promise<
  { ok: true; job: DeployJobRecord } | { ok: false; error: string; statusCode: number }
> {
  if (globalThis.__scientaActiveDeployJob?.status === "running") {
    return {
      ok: false,
      error: "An update job is already running. Wait for it to finish before starting another.",
      statusCode: 409,
    };
  }

  const cfg = await getUpdaterConfig();
  const repoCheck = validateGithubRepoUrl(cfg.repoUrl, cfg.visibility);
  if (!repoCheck.ok) {
    return { ok: false, error: repoCheck.error, statusCode: 400 };
  }
  const branchCheck = validateGitBranch(cfg.branch);
  if (!branchCheck.ok) {
    return { ok: false, error: branchCheck.error, statusCode: 400 };
  }

  const localBefore = await getLocalGitStatus();
  const job: DeployJobRecord = {
    id: crypto.randomUUID(),
    status: "running",
    repoUrl: repoCheck.repo.normalizedUrl,
    branch: branchCheck.branch,
    visibility: repoCheck.repo.visibility,
    triggeredBy,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    fromCommit: localBefore.currentCommitShort,
    toCommit: null,
    steps: createInitialSteps(cfg),
    logs: [],
    error: null,
  };

  globalThis.__scientaActiveDeployJob = job;

  const pushLog = (line: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    job.logs.push(`[${ts}] ${sanitizeDeployLogLine(line)}`);
    if (job.logs.length > MAX_LOG_LINES) {
      job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
    }
  };

  const runStep = async (stepId: string, fn: () => Promise<string | void>) => {
    const step = job.steps.find((s) => s.id === stepId);
    if (!step) return;
    if (step.status === "skipped") {
      pushLog(`Skipping step: ${step.labelEn}`);
      return;
    }
    const startMs = Date.now();
    step.status = "running";
    step.startedAt = new Date().toISOString();
    try {
      const detail = await fn();
      step.status = "success";
      step.finishedAt = new Date().toISOString();
      step.durationMs = Date.now() - startMs;
      if (detail) step.detail = detail;
    } catch (err) {
      step.status = "error";
      step.finishedAt = new Date().toISOString();
      step.durationMs = Date.now() - startMs;
      step.detail = sanitizeDeployLogLine(err instanceof Error ? err.message : String(err));
      throw err;
    }
  };

  // Run pipeline asynchronously in background while updating shared job state
  void (async () => {
    const jobStartMs = Date.now();
    const cwd = process.cwd();
    try {
      let gitEnv: NodeJS.ProcessEnv = process.env;

      await runStep("preflight", async () => {
        pushLog(`Target: ${job.repoUrl} (branch: ${job.branch}, mode: ${job.visibility})`);
        const hasGit = await isBinaryAvailable("git");
        if (!hasGit) throw new Error("Git binary is not installed on this server.");

        if (job.visibility === "private") {
          const hasSsh = await isBinaryAvailable("ssh");
          if (!hasSsh) {
            throw new Error(
              "OpenSSH client (`ssh`) is not installed on this host. Install `openssh-client` to pull private repositories via SSH."
            );
          }
        }

        const envRes = buildGitCommandEnv(job.visibility);
        if (!envRes.ok) throw new Error(envRes.error);
        gitEnv = envRes.env;

        // Verify remote accessibility before touching the working tree
        const lsRes = await runStreamingCommand(
          "git",
          ["ls-remote", "--heads", "--", job.repoUrl, `refs/heads/${job.branch}`],
          { cwd, env: gitEnv, timeoutMs: 25_000 },
          pushLog
        );
        if (lsRes.code !== 0) {
          throw new Error("Could not authenticate with GitHub repository. Verify URL and Deploy Key.");
        }
        return "Remote reachable";
      });

      await runStep("fetch", async () => {
        const hasGitDir = fs.existsSync(path.join(/*turbopackIgnore: true*/ cwd, ".git"));
        if (!hasGitDir) {
          pushLog("No local .git repository detected — initializing git repository cleanly...");
          const initRes = await runStreamingCommand("git", ["init"], { cwd, env: gitEnv, timeoutMs: 15_000 }, pushLog);
          if (initRes.code !== 0) throw new Error("Failed to initialize local git repository.");

          const addRemoteRes = await runStreamingCommand(
            "git",
            ["remote", "add", "origin", "--", job.repoUrl],
            { cwd, env: gitEnv, timeoutMs: 10_000 },
            pushLog
          );
          if (addRemoteRes.code !== 0) {
            await runStreamingCommand(
              "git",
              ["remote", "set-url", "origin", "--", job.repoUrl],
              { cwd, env: gitEnv, timeoutMs: 10_000 },
              pushLog
            );
          }
        } else {
          // Ensure origin points to the configured URL
          const setUrl = await runStreamingCommand(
            "git",
            ["remote", "set-url", "origin", "--", job.repoUrl],
            { cwd, env: gitEnv, timeoutMs: 10_000 },
            pushLog
          );
          if (setUrl.code !== 0) {
            await runStreamingCommand(
              "git",
              ["remote", "add", "origin", "--", job.repoUrl],
              { cwd, env: gitEnv, timeoutMs: 10_000 },
              pushLog
            );
          }
        }

        pushLog(`Fetching origin/${job.branch}...`);
        const fetchRes = await runStreamingCommand(
          "git",
          [
            "-c",
            "pack.threads=1",
            "-c",
            "pack.windowMemory=64m",
            "-c",
            "core.packedGitWindowSize=16m",
            "fetch",
            "--depth",
            "1",
            "origin",
            job.branch,
          ],
          { cwd, env: gitEnv, timeoutMs: 90_000 },
          pushLog
        );
        if (fetchRes.code !== 0) {
          throw new Error(`git fetch failed with exit code ${fetchRes.code}`);
        }
        return `Fetched ${job.branch}`;
      });

      await runStep("checkout", async () => {
        pushLog(`Checking out FETCH_HEAD onto branch ${job.branch}...`);
        const checkoutRes = await runStreamingCommand(
          "git",
          ["checkout", "-B", job.branch, "FETCH_HEAD"],
          { cwd, env: gitEnv, timeoutMs: 30_000 },
          pushLog
        );
        if (checkoutRes.code !== 0) {
          throw new Error(`git checkout failed with exit code ${checkoutRes.code}. Check for local uncommitted conflicts.`);
        }
        invalidateLocalGitStatusCache();
        const localAfter = await getLocalGitStatus(true);
        job.toCommit = localAfter.currentCommitShort;
        pushLog(`Active commit is now ${localAfter.currentCommitShort ?? "unknown"}`);
        return localAfter.currentCommitShort ?? "Updated";
      });

      await runStep("deps", async () => {
        pushLog("Installing Node.js dependencies...");
        const installRes = await runStreamingCommand(
          "npm",
          ["install", "--no-audit", "--no-fund"],
          { cwd, env: process.env, timeoutMs: 240_000 },
          pushLog
        );
        if (installRes.code !== 0) {
          throw new Error(`npm install exited with code ${installRes.code}`);
        }
        return "Dependencies synced";
      });

      await runStep("build", async () => {
        pushLog("Running production Next.js build...");
        const buildRes = await runStreamingCommand(
          "npm",
          ["run", "build"],
          { cwd, env: process.env, timeoutMs: 300_000 },
          pushLog
        );
        if (buildRes.code !== 0) {
          throw new Error(`npm run build exited with code ${buildRes.code}`);
        }
        return "Build succeeded";
      });

      await runStep("db", async () => {
        pushLog("Running post-deploy database index & planner maintenance...");
        const maint = await runDatabaseMaintenance();
        pushLog(
          `Database maintenance complete (${maint.engine}; pruned ${maint.prunedExpiredRefreshTokens} expired sessions).`
        );
        return `Engine: ${maint.engine}`;
      });

      job.status = "success";
      job.finishedAt = new Date().toISOString();
      job.durationMs = Date.now() - jobStartMs;
      pushLog(`Deployment completed successfully in ${(job.durationMs / 1000).toFixed(1)}s. Restart your process manager (e.g. PM2/systemd) if zero-downtime reload is not automatic.`);

      const latestCfg = await getUpdaterConfig();
      await writeSettingJson(UPDATER_CONFIG_KEY, {
        ...latestCfg,
        lastUpdatedAt: job.finishedAt,
        lastError: null,
      });
    } catch (err) {
      const msg = sanitizeDeployLogLine(err instanceof Error ? err.message : String(err));
      job.status = "error";
      job.error = msg;
      job.finishedAt = new Date().toISOString();
      job.durationMs = Date.now() - jobStartMs;
      pushLog(`ERROR: ${msg}`);

      const latestCfg = await getUpdaterConfig();
      await writeSettingJson(UPDATER_CONFIG_KEY, {
        ...latestCfg,
        lastError: msg,
      }).catch(() => {});
    } finally {
      await appendDeployHistory(job).catch(() => {});
    }
  })();

  return { ok: true, job };
}
