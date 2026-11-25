import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accountQuotaConfigInputSchema,
  computeQuotaCpuPercent,
  computeQuotaMetric,
  formatCountCompact,
  parseCgroupMemoryLimit,
  parseCgroupPidsMax,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  parseCgroupV2CpuUsageUsec,
  parseLinuxQuotaOutput,
} from "./account-quota-core";

describe("account-quota-core", () => {
  it("computes exact used, remaining, and percent for 300 MB of 500 MB plan", () => {
    const mb = 1024 * 1024;
    const metric = computeQuotaMetric({
      used: 300 * mb,
      limit: 500 * mb,
      source: "manual_plan",
      detectedLimit: null,
    });

    assert.equal(metric.used, 300 * mb);
    assert.equal(metric.limit, 500 * mb);
    assert.equal(metric.remaining, 200 * mb);
    assert.equal(metric.percent, 60);
    assert.equal(metric.overLimit, false);
    assert.equal(metric.source, "manual_plan");
  });

  it("caps percent at 100 and flags overLimit when usage exceeds plan limit", () => {
    const metric = computeQuotaMetric({
      used: 620,
      limit: 500,
      source: "manual_plan",
      detectedLimit: null,
    });

    assert.equal(metric.remaining, 0);
    assert.equal(metric.percent, 100);
    assert.equal(metric.overLimit, true);
  });

  it("parses standard Linux `quota -w -p` output for blocks and inodes", () => {
    const sample = [
      "Disk quotas for user scienta (uid 1042):",
      "     Filesystem  blocks   quota   limit   grace   files   quota   limit   grace",
      "      /dev/sda3  307200  512000  524288       0   14250  100000  105000       0",
    ].join("\n");

    const parsed = parseLinuxQuotaOutput(sample);
    assert.ok(parsed);
    assert.equal(parsed.filesystem, "/dev/sda3");
    assert.equal(parsed.usedBytes, 307200 * 1024); // 300 MiB
    assert.equal(parsed.effectiveLimitBytes, 512000 * 1024); // 500 MiB
    assert.equal(parsed.usedInodes, 14250);
    assert.equal(parsed.effectiveInodeLimit, 100000);
  });

  it("parses over-quota `*` markers and grace durations in Linux quota output", () => {
    const sample = [
      "Disk quotas for user web123 (uid 1088):",
      "Filesystem blocks quota limit grace files quota limit grace",
      "/dev/nvme0n1p2 530000* 512000 550000 6days 98200 100000 100000 0",
    ].join("\n");

    const parsed = parseLinuxQuotaOutput(sample);
    assert.ok(parsed);
    assert.equal(parsed.usedBytes, 530000 * 1024);
    assert.equal(parsed.effectiveLimitBytes, 512000 * 1024);
    assert.equal(parsed.usedInodes, 98200);
    assert.equal(parsed.effectiveInodeLimit, 100000);
  });

  it("returns null for empty or quota-less output", () => {
    assert.equal(parseLinuxQuotaOutput(""), null);
    assert.equal(
      parseLinuxQuotaOutput("Disk quotas for user root (uid 0): none\n"),
      null
    );
  });

  it("parses cgroup v2 & v1 memory limits while filtering unlimited sentinels", () => {
    const hostTotal = 64 * 1024 * 1024 * 1024; // 64 GiB
    assert.equal(parseCgroupMemoryLimit("max\n", hostTotal), null);
    assert.equal(parseCgroupMemoryLimit("9223372036854771712\n", hostTotal), null);
    assert.equal(parseCgroupMemoryLimit(String(hostTotal), hostTotal), null);
    assert.equal(
      parseCgroupMemoryLimit(String(1024 * 1024 * 1024), hostTotal),
      1024 * 1024 * 1024
    );
  });

  it("parses cgroup v2 cpu.max and cgroup v1 cfs quota accurately", () => {
    assert.equal(parseCgroupV2CpuMax("max 100000\n"), null);
    assert.equal(parseCgroupV2CpuMax("100000 100000\n"), 1);
    assert.equal(parseCgroupV2CpuMax("50000 100000\n"), 0.5);
    assert.equal(parseCgroupV2CpuMax("250000 100000\n"), 2.5);

    assert.equal(parseCgroupV1CpuQuota("-1\n", "100000\n"), null);
    assert.equal(parseCgroupV1CpuQuota("150000\n", "100000\n"), 1.5);
  });

  it("parses cgroup v2 cpu.stat usage_usec and pids.max", () => {
    const stat = "usage_usec 48192012\nuser_usec 30100000\nsystem_usec 18092012\n";
    assert.equal(parseCgroupV2CpuUsageUsec(stat), 48192012);
    assert.equal(parseCgroupPidsMax("max\n"), null);
    assert.equal(parseCgroupPidsMax("25\n"), 25);
  });

  it("computes normalized CPU utilization percent against allocated vCPU cores", () => {
    // 500ms of CPU time in 1000ms wall time on 1 vCPU = 50%
    assert.equal(
      computeQuotaCpuPercent({ cpuDeltaUsec: 500_000, wallDeltaMs: 1000, allocatedCores: 1 }),
      50
    );
    // 500ms of CPU time in 1000ms wall time on 2 vCPUs = 25%
    assert.equal(
      computeQuotaCpuPercent({ cpuDeltaUsec: 500_000, wallDeltaMs: 1000, allocatedCores: 2 }),
      25
    );
    // Clamps to 100% max
    assert.equal(
      computeQuotaCpuPercent({ cpuDeltaUsec: 3_000_000, wallDeltaMs: 1000, allocatedCores: 1 }),
      100
    );
  });

  it("validates account quota configuration payloads with Zod", () => {
    const valid = accountQuotaConfigInputSchema.safeParse({
      planLabel: "cPanel 500MB Starter",
      diskLimitMb: 500,
      ramLimitMb: 1024,
      cpuCores: 1,
      inodeLimit: 100000,
      entryProcessLimit: 20,
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.diskLimitMb, 500);
      assert.equal(valid.data.ramLimitMb, 1024);
      assert.equal(valid.data.cpuCores, 1);
    }

    // Empty strings / nulls reset fields to Auto-Detect (null)
    const autoReset = accountQuotaConfigInputSchema.safeParse({
      planLabel: "",
      diskLimitMb: "",
      ramLimitMb: null,
      cpuCores: undefined,
      inodeLimit: "",
      entryProcessLimit: null,
    });
    assert.equal(autoReset.success, true);
    if (autoReset.success) {
      assert.equal(autoReset.data.diskLimitMb, null);
      assert.equal(autoReset.data.ramLimitMb, null);
      assert.equal(autoReset.data.cpuCores, null);
    }

    // Out-of-bounds negative values rejected
    const invalid = accountQuotaConfigInputSchema.safeParse({
      planLabel: "Bad",
      diskLimitMb: -50,
      ramLimitMb: 1024,
      cpuCores: 1,
      inodeLimit: 1000,
      entryProcessLimit: 10,
    });
    assert.equal(invalid.success, false);
  });

  it("formats compact integer counts cleanly", () => {
    assert.equal(formatCountCompact(0), "0");
    assert.equal(formatCountCompact(14250), "14,250");
    assert.equal(formatCountCompact(250000), "250.0K");
    assert.equal(formatCountCompact(1_500_000), "1.50M");
  });
});
