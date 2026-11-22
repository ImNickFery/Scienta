import crypto from "node:crypto";

export type RepoVisibility = "public" | "private";

export interface ValidatedGithubRepo {
  owner: string;
  repo: string;
  httpsUrl: string;
  sshUrl: string;
  normalizedUrl: string;
  visibility: RepoVisibility;
}

export interface GeneratedSshKeypair {
  algorithm: "ed25519";
  publicKey: string;
  privateKey: string;
  fingerprintSha256: string;
  comment: string;
  createdAt: string;
}

export interface UpdaterConfig {
  repoUrl: string;
  branch: string;
  visibility: RepoVisibility;
  autoInstallDeps: boolean;
  autoBuild: boolean;
  autoOptimizeDb: boolean;
  lastCheckedAt: string | null;
  lastUpdatedAt: string | null;
  lastRemoteCommit: string | null;
  lastRemoteMessage: string | null;
  lastError: string | null;
}

export interface DeployStep {
  id: string;
  labelEn: string;
  labelFa: string;
  status: "pending" | "running" | "success" | "skipped" | "error";
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  detail?: string;
}

export interface DeployJobRecord {
  id: string;
  status: "idle" | "running" | "success" | "error";
  repoUrl: string;
  branch: string;
  visibility: RepoVisibility;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  fromCommit: string | null;
  toCommit: string | null;
  steps: DeployStep[];
  logs: string[];
  error: string | null;
}

export const DEFAULT_UPDATER_CONFIG: UpdaterConfig = {
  repoUrl: "",
  branch: "main",
  visibility: "public",
  autoInstallDeps: true,
  autoBuild: true,
  autoOptimizeDb: true,
  lastCheckedAt: null,
  lastUpdatedAt: null,
  lastRemoteCommit: null,
  lastRemoteMessage: null,
  lastError: null,
};

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const SHELL_META_RE = /[\s;&|`$<>()\\'"\r\n\0]/;

/**
 * Strictly validates and normalizes a GitHub repository URL.
 * Only allows `github.com` HTTPS or SSH URLs and rejects all shell metacharacters,
 * leading dashes (git option injection), or non-GitHub hosts.
 */
export function validateGithubRepoUrl(
  rawUrl: string,
  preferredVisibility?: RepoVisibility
): { ok: true; repo: ValidatedGithubRepo } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "Repository URL is required." };
  }
  if (trimmed.length > 300 || trimmed.startsWith("-") || SHELL_META_RE.test(trimmed)) {
    return { ok: false, error: "Repository URL contains invalid characters." };
  }

  let owner = "";
  let repo = "";
  let detectedVisibility: RepoVisibility = "public";

  // 1) SCP-like SSH format: git@github.com:owner/repo(.git)
  const sshScpMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed);
  if (sshScpMatch) {
    owner = sshScpMatch[1];
    repo = sshScpMatch[2];
    detectedVisibility = "private";
  } else if (/^ssh:\/\/git@github\.com\//i.test(trimmed)) {
    // 2) Explicit ssh://git@github.com/owner/repo(.git)
    const sshUriMatch = /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed);
    if (!sshUriMatch) {
      return { ok: false, error: "Invalid GitHub SSH URL format. Expected git@github.com:owner/repo.git" };
    }
    owner = sshUriMatch[1];
    repo = sshUriMatch[2];
    detectedVisibility = "private";
  } else {
    // 3) HTTPS format: https://github.com/owner/repo(.git)
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        ok: false,
        error: "Invalid GitHub URL. Use https://github.com/owner/repo or git@github.com:owner/repo.git",
      };
    }

    if (parsed.protocol !== "https:") {
      return { ok: false, error: "Only HTTPS or SSH GitHub URLs are allowed." };
    }
    if (parsed.hostname.toLowerCase() !== "github.com") {
      return { ok: false, error: "Only github.com repositories are supported." };
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      return {
        ok: false,
        error: "Do not embed credentials or query strings in the repository URL. Use SSH Deploy Keys for private repos.",
      };
    }

    const segments = parsed.pathname
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (segments.length !== 2) {
      return { ok: false, error: "Expected https://github.com/<owner>/<repository>." };
    }
    owner = segments[0];
    repo = segments[1].replace(/\.git$/i, "");
    detectedVisibility = "public";
  }

  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === "." || repo === ".." || repo.includes("..")) {
    return { ok: false, error: "Invalid GitHub owner or repository name." };
  }

  const httpsUrl = `https://github.com/${owner}/${repo}.git`;
  const sshUrl = `git@github.com:${owner}/${repo}.git`;
  const visibility = preferredVisibility ?? detectedVisibility;

  return {
    ok: true,
    repo: {
      owner,
      repo,
      httpsUrl,
      sshUrl,
      normalizedUrl: visibility === "private" ? sshUrl : httpsUrl,
      visibility,
    },
  };
}

/**
 * Strictly validates a Git branch name (blocks flag injection, path traversal `..`, and metacharacters).
 */
export function validateGitBranch(rawBranch: string): { ok: true; branch: string } | { ok: false; error: string } {
  const branch = rawBranch.trim();
  if (!branch) {
    return { ok: false, error: "Branch name is required." };
  }
  if (
    !BRANCH_RE.test(branch) ||
    branch.startsWith("-") ||
    branch.includes("..") ||
    branch.includes("//") ||
    branch.endsWith("/") ||
    branch.endsWith(".lock") ||
    SHELL_META_RE.test(branch)
  ) {
    return { ok: false, error: "Invalid branch name." };
  }
  return { ok: true, branch };
}

/**
 * Encodes a length-prefixed binary string per RFC 4251 / OpenSSH wire format.
 */
function sshPackString(buf: Buffer | string): Buffer {
  const data = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  return Buffer.concat([len, data]);
}

function sshPackUint32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

/**
 * Generates a cryptographically genuine Ed25519 OpenSSH Deploy Keypair using
 * Node's built-in `node:crypto` — works identically in minimal containers
 * without requiring the `ssh-keygen` binary, and produces standard OpenSSH
 * public/private files accepted directly by GitHub Deploy Keys and OpenSSH clients.
 */
export function generateOpenSshEd25519Keypair(comment: string = "scienta-panel-deploy"): GeneratedSshKeypair {
  const safeComment = comment.replace(/[^A-Za-z0-9._@-]/g, "-").slice(0, 64) || "scienta-panel-deploy";
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  // Extract raw 32-byte Ed25519 public key from SPKI DER (last 32 bytes of 44-byte Ed25519 SPKI)
  const spkiDer = publicKey.export({ format: "der", type: "spki" });
  const rawPub = spkiDer.subarray(spkiDer.length - 32);

  // Extract raw 32-byte Ed25519 private seed from PKCS8 DER (last 32 bytes of 48-byte Ed25519 PKCS8)
  const pkcs8Der = privateKey.export({ format: "der", type: "pkcs8" });
  const rawSeed = pkcs8Der.subarray(pkcs8Der.length - 32);

  // OpenSSH public key blob: string("ssh-ed25519") || string(32-byte pubkey)
  const keyType = "ssh-ed25519";
  const pubBlob = Buffer.concat([sshPackString(keyType), sshPackString(rawPub)]);
  const publicKeyLine = `${keyType} ${pubBlob.toString("base64")} ${safeComment}`;

  // Standard OpenSSH SHA-256 fingerprint (matches `ssh-keygen -lf`)
  const sha256B64 = crypto
    .createHash("sha256")
    .update(pubBlob)
    .digest("base64")
    .replace(/=+$/g, "");
  const fingerprintSha256 = `SHA256:${sha256B64}`;

  // OpenSSH private key format (`openssh-key-v1`)
  const checkInt = crypto.randomBytes(4).readUInt32BE(0);
  const rawPriv64 = Buffer.concat([rawSeed, rawPub]); // Ed25519 OpenSSH private key is seed || pub (64 bytes)
  let privateSection = Buffer.concat([
    sshPackUint32(checkInt),
    sshPackUint32(checkInt),
    sshPackString(keyType),
    sshPackString(rawPub),
    sshPackString(rawPriv64),
    sshPackString(safeComment),
  ]);

  // Pad private section to 8-byte block boundary with 1, 2, 3, ...
  const blockSize = 8;
  const padLen = (blockSize - (privateSection.length % blockSize)) % blockSize;
  if (padLen > 0) {
    const pad = Buffer.alloc(padLen);
    for (let i = 0; i < padLen; i += 1) {
      pad[i] = i + 1;
    }
    privateSection = Buffer.concat([privateSection, pad]);
  }

  const fullPrivateBlob = Buffer.concat([
    Buffer.from("openssh-key-v1\0", "ascii"),
    sshPackString("none"), // ciphername
    sshPackString("none"), // kdfname
    sshPackString(Buffer.alloc(0)), // kdfoptions
    sshPackUint32(1), // number of keys
    sshPackString(pubBlob), // public key blob
    sshPackString(privateSection), // private section blob
  ]);

  const b64 = fullPrivateBlob.toString("base64");
  const wrapped = b64.match(/.{1,70}/g)?.join("\n") ?? b64;
  const privateKeyPem = `-----BEGIN OPENSSH PRIVATE KEY-----\n${wrapped}\n-----END OPENSSH PRIVATE KEY-----\n`;

  return {
    algorithm: "ed25519",
    publicKey: publicKeyLine,
    privateKey: privateKeyPem,
    fingerprintSha256,
    comment: safeComment,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Redacts accidental secrets, private key blocks, or GitHub PATs before storing/streaming logs.
 */
export function sanitizeDeployLogLine(line: string): string {
  return line
    .replace(/-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]+PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]")
    .replace(/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@github\.com/gi, "https://[REDACTED]@github.com")
    .slice(0, 500);
}

/**
 * Formats byte counts into crisp human-readable units (B, KB, MB, GB, TB).
 */
export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / 1024 ** idx;
  const decimals = idx >= 3 ? 2 : idx >= 2 ? 1 : 0;
  return `${val.toFixed(decimals)} ${units[idx]}`;
}

/**
 * Formats network throughput rates (bytes/sec) into compact units (B/s, KB/s, MB/s, GB/s).
 */
export function formatRateCompact(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytesPerSec) / Math.log(1024)));
  const val = bytesPerSec / 1024 ** idx;
  const decimals = idx >= 2 ? 2 : idx === 1 ? 1 : 0;
  return `${val.toFixed(decimals)} ${units[idx]}`;
}

/**
 * Computes rounded min, average, and peak statistics across a series of percentage samples.
 */
export function computeMetricStats(samples: number[]): { min: number; avg: number; peak: number } {
  const valid = samples.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return { min: 0, avg: 0, peak: 0 };
  let min = valid[0];
  let peak = valid[0];
  let sum = 0;
  for (const n of valid) {
    if (n < min) min = n;
    if (n > peak) peak = n;
    sum += n;
  }
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    min: round1(min),
    avg: round1(sum / valid.length),
    peak: round1(peak),
  };
}

export function getUsageSeverity(percent: number): "healthy" | "elevated" | "critical" {
  if (percent >= 85) return "critical";
  if (percent >= 65) return "elevated";
  return "healthy";
}
