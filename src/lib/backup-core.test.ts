import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertInsideBackupStaging,
  BOT_API_MAX_BYTES,
  computeNextScheduledUtcRun,
  decryptBackupSecret,
  encryptBackupSecret,
  inspectBackupStagingDisk,
  isScheduledRunDue,
  redactBackupSecrets,
  selectTelegramTransport,
  shouldIncludeSitePath,
  timingSafeEqualSecret,
  verifyAndPurgeBackupArtifacts,
} from "./backup-core";

test("encryptBackupSecret / decryptBackupSecret round-trip and reject tampered ciphertext", () => {
  const secretKey = "unit-test-backup-secret-key-2026";
  const token = "7123456789:AAH_test_bot_token_secret_payload_12345";
  const encrypted = encryptBackupSecret(token, secretKey);

  assert.ok(encrypted.startsWith("v1:"));
  assert.notEqual(encrypted, token);
  assert.equal(decryptBackupSecret(encrypted, secretKey), token);

  // Tampering with auth tag or payload fails decryption cleanly
  const tampered = `${encrypted.slice(0, -2)}AA`;
  assert.equal(decryptBackupSecret(tampered, secretKey), "");
  assert.equal(decryptBackupSecret(encrypted, "wrong-key"), "");
});

test("redactBackupSecrets masks bot tokens and 32-char hex hashes", () => {
  const msg =
    "Telegram failed on https://api.telegram.org/bot7123456789:AAH_VerySecretBotToken_9876543210/sendDocument with hash 0123456789abcdef0123456789abcdef";
  const safe = redactBackupSecrets(msg);
  assert.ok(!safe.includes("AAH_VerySecretBotToken_9876543210"));
  assert.ok(!safe.includes("0123456789abcdef0123456789abcdef"));
  assert.ok(safe.includes("[REDACTED_BOT_TOKEN]"));
});

test("UTC 00:00 schedule math computes next midnight rollover and avoids duplicate same-day runs", () => {
  const beforeMidnight = new Date("2026-11-25T23:45:00.000Z");
  const next1 = computeNextScheduledUtcRun(0, 0, beforeMidnight);
  assert.equal(next1.toISOString(), "2026-11-26T00:00:00.000Z");

  const exactMidnight = new Date("2026-11-26T00:00:00.000Z");
  const next2 = computeNextScheduledUtcRun(0, 0, exactMidnight);
  assert.equal(next2.toISOString(), "2026-11-27T00:00:00.000Z");

  assert.equal(
    isScheduledRunDue({
      enabled: true,
      scheduleUtcHour: 0,
      scheduleUtcMinute: 0,
      lastScheduledUtcDate: "2026-11-25",
      now: new Date("2026-11-26T00:02:00.000Z"),
    }),
    true
  );

  // Already ran today -> must not re-fire
  assert.equal(
    isScheduledRunDue({
      enabled: true,
      scheduleUtcHour: 0,
      scheduleUtcMinute: 0,
      lastScheduledUtcDate: "2026-11-26",
      now: new Date("2026-11-26T00:05:00.000Z"),
    }),
    false
  );

  // Disabled -> never fires
  assert.equal(
    isScheduledRunDue({
      enabled: false,
      scheduleUtcHour: 0,
      scheduleUtcMinute: 0,
      lastScheduledUtcDate: "",
      now: new Date("2026-11-26T00:01:00.000Z"),
    }),
    false
  );
});

test("selectTelegramTransport prioritizes MTProto when api_id + api_hash exist and enforces 50 MB Bot API cap", () => {
  const autoLargeWithMtproto = selectTelegramTransport({
    preference: "auto",
    fileSizeBytes: 350 * 1024 * 1024,
    hasBotToken: true,
    hasApiId: true,
    hasApiHash: true,
  });
  assert.deepEqual(autoLargeWithMtproto, { ok: true, transport: "mtproto" });

  const autoSmallNoMtproto = selectTelegramTransport({
    preference: "auto",
    fileSizeBytes: 12 * 1024 * 1024,
    hasBotToken: true,
    hasApiId: false,
    hasApiHash: false,
  });
  assert.deepEqual(autoSmallNoMtproto, { ok: true, transport: "bot_api" });

  const autoLargeNoMtproto = selectTelegramTransport({
    preference: "auto",
    fileSizeBytes: BOT_API_MAX_BYTES + 1024,
    hasBotToken: true,
    hasApiId: false,
    hasApiHash: false,
  });
  assert.equal(autoLargeNoMtproto.ok, false);
  assert.match(autoLargeNoMtproto.error ?? "", /api_id/i);
});

test("assertInsideBackupStaging blocks directory traversal and sibling prefix escapes", () => {
  const root = "/tmp/scienta-backups";
  assert.equal(
    assertInsideBackupStaging("/tmp/scienta-backups/run-123/db.tar.gz", root),
    path.resolve("/tmp/scienta-backups/run-123/db.tar.gz")
  );
  assert.throws(() => assertInsideBackupStaging("/tmp/scienta-backups", root));
  assert.throws(() => assertInsideBackupStaging("/tmp/scienta-backups-evil/file.tar.gz", root));
  assert.throws(() => assertInsideBackupStaging("/tmp/scienta-backups/../etc/passwd", root));
});

test("shouldIncludeSitePath always excludes backup staging root and honors user toggles", () => {
  const defaultOpts = {
    includeEnvFile: true,
    includeNodeModules: false,
    includeNextBuild: false,
    includeGitDir: false,
  };

  assert.equal(shouldIncludeSitePath("tmp/scienta-backups/run-1/full.tar.gz", defaultOpts), false);
  assert.equal(shouldIncludeSitePath(".playwright-cli/snap.png", defaultOpts), false);
  assert.equal(shouldIncludeSitePath("node_modules/next/package.json", defaultOpts), false);
  assert.equal(shouldIncludeSitePath(".next/server/app.js", defaultOpts), false);
  assert.equal(shouldIncludeSitePath(".env", defaultOpts), true);
  assert.equal(shouldIncludeSitePath("src/app/page.tsx", defaultOpts), true);
  assert.equal(shouldIncludeSitePath("public/uploads/media/img.webp", defaultOpts), true);

  assert.equal(
    shouldIncludeSitePath("node_modules/next/package.json", {
      ...defaultOpts,
      includeNodeModules: true,
    }),
    true
  );
  assert.equal(
    shouldIncludeSitePath(".env", {
      ...defaultOpts,
      includeEnvFile: false,
    }),
    false
  );
});

test("verifyAndPurgeBackupArtifacts deletes both backup files and verifies 0 leftovers across 3 passes", async () => {
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "scienta-backup-test-"));
  const stagingRoot = path.join(tempBase, "scienta-backups");
  const runDir = path.join(stagingRoot, "run-unit-01");
  fs.mkdirSync(runDir, { recursive: true });

  const dbFile = path.join(runDir, "scienta-db.tar.gz");
  const fullFile = path.join(runDir, "scienta-full.tar.gz");
  fs.writeFileSync(dbFile, "db-archive-bytes");
  fs.writeFileSync(fullFile, "full-site-archive-bytes");

  assert.equal(inspectBackupStagingDisk(stagingRoot).clean, false);

  try {
    const report = await verifyAndPurgeBackupArtifacts({
      stagingRoot,
      runDir,
      artifactPaths: [dbFile, fullFile],
      passes: 3,
      passDelayMs: 5,
    });

    assert.equal(report.verified, true);
    assert.equal(report.passesCompleted, 3);
    assert.equal(report.remainingFiles, 0);
    assert.equal(report.remainingBytes, 0);
    assert.equal(fs.existsSync(dbFile), false);
    assert.equal(fs.existsSync(fullFile), false);
    assert.equal(fs.existsSync(runDir), false);
    assert.equal(inspectBackupStagingDisk(stagingRoot).clean, true);
    assert.equal(
      report.passes.every((p) => p.passed && !p.dbArchiveExists && !p.fullArchiveExists && !p.runDirExists),
      true
    );
  } finally {
    fs.rmSync(tempBase, { recursive: true, force: true });
  }
});

test("timingSafeEqualSecret compares cron secrets safely", () => {
  assert.equal(timingSafeEqualSecret("super-secret-123456", "super-secret-123456"), true);
  assert.equal(timingSafeEqualSecret("super-secret-123456", "super-secret-123457"), false);
  assert.equal(timingSafeEqualSecret("super-secret-123456", "short"), false);
  assert.equal(timingSafeEqualSecret("", ""), false);
});
