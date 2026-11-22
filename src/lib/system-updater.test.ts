import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeMetricStats,
  formatBytesCompact,
  formatRateCompact,
  generateOpenSshEd25519Keypair,
  getUsageSeverity,
  sanitizeDeployLogLine,
  validateGitBranch,
  validateGithubRepoUrl,
} from "./system-updater-core";
import {
  collectSystemTelemetry,
  computeCpuPercentFromDeltas,
  computeNetworkRatesFromDeltas,
} from "./system-telemetry";
import {
  deleteSshDeployKey,
  generateOrRotateSshDeployKey,
  getSshKeyStatus,
} from "./system-updater";

test("validateGithubRepoUrl accepts public HTTPS and private SSH GitHub URLs and normalizes visibility", () => {
  const pub = validateGithubRepoUrl("https://github.com/MHSanaei/3x-ui");
  assert.equal(pub.ok, true);
  if (pub.ok) {
    assert.equal(pub.repo.owner, "MHSanaei");
    assert.equal(pub.repo.repo, "3x-ui");
    assert.equal(pub.repo.visibility, "public");
    assert.equal(pub.repo.normalizedUrl, "https://github.com/MHSanaei/3x-ui.git");
    assert.equal(pub.repo.sshUrl, "git@github.com:MHSanaei/3x-ui.git");
  }

  // Converting HTTPS -> Private SSH
  const converted = validateGithubRepoUrl("https://github.com/MHSanaei/3x-ui", "private");
  assert.equal(converted.ok, true);
  if (converted.ok) {
    assert.equal(converted.repo.visibility, "private");
    assert.equal(converted.repo.normalizedUrl, "git@github.com:MHSanaei/3x-ui.git");
  }

  // SCP-style SSH URL
  const scp = validateGithubRepoUrl("git@github.com:acme-org/scienta-private.git");
  assert.equal(scp.ok, true);
  if (scp.ok) {
    assert.equal(scp.repo.visibility, "private");
    assert.equal(scp.repo.httpsUrl, "https://github.com/acme-org/scienta-private.git");
    assert.equal(scp.repo.normalizedUrl, "git@github.com:acme-org/scienta-private.git");
  }

  // ssh:// URL
  const sshUri = validateGithubRepoUrl("ssh://git@github.com/acme-org/scienta.git");
  assert.equal(sshUri.ok, true);
});

test("validateGithubRepoUrl blocks command injection, flag injection, non-GitHub SSRF, and embedded secrets", () => {
  const malicious = [
    "",
    "--upload-pack=touch /tmp/pwn",
    "https://github.com/owner/repo.git; rm -rf /",
    "git@github.com:owner/repo$(id).git",
    "https://127.0.0.1/owner/repo.git",
    "https://gitlab.com/owner/repo.git",
    "http://github.com/owner/repo.git",
    "file:///etc/passwd",
    "ext::sh -c id",
    "https://user:ghp_secret123@github.com/owner/repo.git",
    "https://github.com/owner/..",
  ];

  for (const input of malicious) {
    const res = validateGithubRepoUrl(input);
    assert.equal(res.ok, false, `Expected URL to be rejected: ${input}`);
  }
});

test("validateGitBranch allows clean branch names and blocks option/traversal/shell payloads", () => {
  for (const okBranch of ["main", "master", "release/v2.4.0", "feature_deploy-1"]) {
    const res = validateGitBranch(okBranch);
    assert.equal(res.ok, true, `Expected branch to be accepted: ${okBranch}`);
  }

  for (const badBranch of ["", "-b", "--exec=id", "main..dev", "main;id", "foo bar", "refs//bad", "dev.lock"]) {
    const res = validateGitBranch(badBranch);
    assert.equal(res.ok, false, `Expected branch to be rejected: ${badBranch}`);
  }
});

test("generateOpenSshEd25519Keypair creates valid OpenSSH public/private keys and unique SHA-256 fingerprints", () => {
  const k1 = generateOpenSshEd25519Keypair("scienta-test");
  const k2 = generateOpenSshEd25519Keypair("scienta-test");

  assert.equal(k1.algorithm, "ed25519");
  assert.ok(k1.publicKey.startsWith("ssh-ed25519 AAAA"));
  assert.ok(k1.publicKey.endsWith(" scienta-test"));
  assert.ok(k1.fingerprintSha256.startsWith("SHA256:"));
  assert.ok(k1.privateKey.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----\n"));
  assert.ok(k1.privateKey.trimEnd().endsWith("-----END OPENSSH PRIVATE KEY-----"));

  // Decode base64 private key body and confirm OpenSSH v1 magic header
  const privBody = k1.privateKey
    .replace("-----BEGIN OPENSSH PRIVATE KEY-----", "")
    .replace("-----END OPENSSH PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const privBuf = Buffer.from(privBody, "base64");
  assert.equal(privBuf.subarray(0, 15).toString("ascii"), "openssh-key-v1\0");

  // Confirm key uniqueness
  assert.notEqual(k1.publicKey, k2.publicKey);
  assert.notEqual(k1.fingerprintSha256, k2.fingerprintSha256);
});

test("sanitizeDeployLogLine redacts GitHub tokens, private keys, and URL credentials", () => {
  assert.equal(
    sanitizeDeployLogLine("Token ghp_abcdefghijklmnopqrstuvwxyz123456 leaked"),
    "Token [REDACTED_GITHUB_TOKEN] leaked"
  );
  assert.equal(
    sanitizeDeployLogLine("https://alice:secretpass@github.com/alice/repo.git"),
    "https://[REDACTED]@github.com/alice/repo.git"
  );
  assert.equal(
    sanitizeDeployLogLine("-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----"),
    "[REDACTED PRIVATE KEY]"
  );
});

test("computeCpuPercentFromDeltas and collectSystemTelemetry report accurate real-time metrics", async () => {
  assert.equal(
    computeCpuPercentFromDeltas({ idle: 100, total: 200 }, { idle: 150, total: 300 }, 0, 4),
    50
  );
  assert.equal(
    computeCpuPercentFromDeltas({ idle: 100, total: 200 }, { idle: 200, total: 300 }, 0, 4),
    0
  );
  assert.equal(
    computeCpuPercentFromDeltas({ idle: 100, total: 200 }, { idle: 100, total: 300 }, 0, 4),
    100
  );

  const { snapshot } = await collectSystemTelemetry();
  assert.ok(snapshot.cpu.cores >= 1);
  assert.ok(snapshot.cpu.percent >= 0 && snapshot.cpu.percent <= 100);
  assert.ok(snapshot.memory.totalBytes > 0);
  assert.ok(snapshot.memory.percent >= 0 && snapshot.memory.percent <= 100);
  assert.ok(snapshot.disk.totalBytes > 0);
  assert.ok(snapshot.disk.percent >= 0 && snapshot.disk.percent <= 100);
  assert.ok(snapshot.network.totalRxBytes >= 0);
  assert.ok(snapshot.network.totalTxBytes >= 0);
  assert.ok(snapshot.runtime.nodeVersion.startsWith("v"));
  assert.equal(formatBytesCompact(1024 * 1024 * 1024), "1.00 GB");
  assert.equal(formatRateCompact(0), "0 B/s");
  assert.equal(formatRateCompact(1536), "1.5 KB/s");
  assert.equal(formatRateCompact(2 * 1024 * 1024), "2.00 MB/s");
  assert.deepEqual(computeMetricStats([12.4, 48.9, 25.1]), { min: 12.4, avg: 28.8, peak: 48.9 });
  assert.deepEqual(computeMetricStats([]), { min: 0, avg: 0, peak: 0 });
  assert.deepEqual(
    computeNetworkRatesFromDeltas(
      { rxBytes: 1000, txBytes: 500, interfaceCount: 1, capturedAtMs: 10_000 },
      { rxBytes: 5000, txBytes: 2500, interfaceCount: 1, capturedAtMs: 12_000 }
    ),
    { rxBytesPerSec: 2000, txBytesPerSec: 1000 }
  );
  assert.equal(getUsageSeverity(40), "healthy");
  assert.equal(getUsageSeverity(70), "elevated");
  assert.equal(getUsageSeverity(92), "critical");
});

test("SSH key persistence enforces 0600 permissions, never exposes private key, and revokes cleanly", async () => {
  const tmpDir = path.join(os.tmpdir(), `scienta-ssh-test-${Date.now()}`);
  const prevEnv = process.env.SCIENTA_SSH_DIR;
  process.env.SCIENTA_SSH_DIR = tmpDir;

  try {
    const emptyStatus = await getSshKeyStatus();
    assert.equal(emptyStatus.exists, false);
    assert.equal(emptyStatus.publicKey, null);

    const created = await generateOrRotateSshDeployKey("unit-test");
    assert.equal(created.exists, true);
    assert.equal(created.algorithm, "ed25519");
    assert.ok(created.publicKey?.startsWith("ssh-ed25519 "));
    assert.ok(created.fingerprintSha256?.startsWith("SHA256:"));
    assert.equal("privateKey" in created, false, "Private key must never be returned by status API");

    // Verify private key on disk has strict 0600 permissions
    const privPath = path.join(tmpDir, "id_ed25519");
    assert.equal(fs.existsSync(privPath), true);
    const mode = fs.statSync(privPath).mode & 0o777;
    assert.equal(mode, 0o600);

    const afterDelete = await deleteSshDeployKey();
    assert.equal(afterDelete.exists, false);
    assert.equal(fs.existsSync(privPath), false);
  } finally {
    if (prevEnv === undefined) delete process.env.SCIENTA_SSH_DIR;
    else process.env.SCIENTA_SSH_DIR = prevEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
