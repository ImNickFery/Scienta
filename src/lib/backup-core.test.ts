import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertInsideBackupStaging,
  backupSettingsUpdateSchema,
  BOT_API_MAX_BYTES,
  computeNextScheduledUtcRun,
  decryptBackupSecret,
  encryptBackupSecret,
  inspectBackupStagingDisk,
  isPrivateOrReservedIp,
  isScheduledRunDue,
  normalizeDigitsToAscii,
  normalizeTelegramApiId,
  normalizeTelegramBotToken,
  normalizeTelegramChatId,
  redactBackupSecrets,
  selectTelegramTransport,
  shouldIncludeSitePath,
  timingSafeEqualSecret,
  validateTelegramApiBaseUrl,
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

test("Telegram normalizers sanitize Persian digits, bot prefix, and t.me channel links", () => {
  assert.equal(normalizeDigitsToAscii("−۱۰۰۱۲۳۴۵۶۷۸۹۰"), "-1001234567890");
  assert.equal(normalizeTelegramBotToken("  bot123456789:AAH_abc123  \n"), "123456789:AAH_abc123");
  assert.equal(normalizeTelegramBotToken("۱۲۳۴۵۶:AAH_secret"), "123456:AAH_secret");
  assert.equal(normalizeTelegramChatId("https://t.me/scienta_backups/42"), "@scienta_backups");
  assert.equal(normalizeTelegramChatId("t.me/c/1987654321/15"), "-1001987654321");
  assert.equal(normalizeTelegramChatId("−۱۰۰۱۲۳۴۵۶"), "-100123456");
  assert.equal(normalizeTelegramApiId("۲۴۸۱۹۲۰۴ "), "24819204");

  const parsed = backupSettingsUpdateSchema.parse({
    telegramBotToken: "bot777888:AAH_token_xyz",
    telegramChatId: "https://t.me/scienta_chan",
    telegramApiId: "۲۴۸۱۹۲۰۴",
    telegramApiBaseUrl: "https://tg-proxy.example.workers.dev/",
  });
  assert.equal(parsed.telegramBotToken, "777888:AAH_token_xyz");
  assert.equal(parsed.telegramChatId, "@scienta_chan");
  assert.equal(parsed.telegramApiId, "24819204");
  assert.equal(parsed.telegramApiBaseUrl, "https://tg-proxy.example.workers.dev");
});

test("validateTelegramApiBaseUrl allows public HTTPS proxies and blocks internal/private targets", () => {
  assert.deepEqual(validateTelegramApiBaseUrl(""), { ok: true, normalized: "" });
  assert.deepEqual(validateTelegramApiBaseUrl("https://my-tg.workers.dev///"), {
    ok: true,
    normalized: "https://my-tg.workers.dev",
  });

  // Non-HTTPS, localhost, private IPv4, link-local metadata, IPv6 loopback, embedded creds, query
  assert.equal(validateTelegramApiBaseUrl("http://my-tg.workers.dev").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://localhost/bot").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://127.0.0.1").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://169.254.169.254/latest").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://10.0.0.5").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://192.168.1.10").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://[::1]").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://user:pass@my-tg.workers.dev").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://my-tg.workers.dev?foo=bar").ok, false);
  assert.equal(validateTelegramApiBaseUrl("https://my-tg.workers.dev:8080").ok, false);

  assert.equal(isPrivateOrReservedIp("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateOrReservedIp("169.254.169.254"), true);
  assert.equal(isPrivateOrReservedIp("149.154.167.220"), false);
});
