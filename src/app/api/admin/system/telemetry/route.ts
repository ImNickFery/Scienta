import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/session";
import {
  collectSystemTelemetry,
  type CpuTickSnapshot,
  type NetworkTickSnapshot,
} from "@/lib/system-telemetry";
import { recordApiMetric } from "@/lib/performance-telemetry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clampIntervalMs(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2000;
  return Math.max(1000, Math.min(10_000, Math.round(n)));
}

/**
 * Real-time hardware & runtime telemetry endpoint:
 * - `?mode=snapshot` returns a single JSON sample immediately.
 * - Default streams Server-Sent Events (SSE) every `interval` ms (default 2s)
 *   with accurate delta CPU %, RAM/Swap, Disk, Network I/O, and Node runtime metrics.
 */
export async function GET(req: Request) {
  const startedAt = performance.now();
  const { response } = await requireApiAuth("settings.manage");
  if (response) return response;

  const url = new URL(req.url);
  if (url.searchParams.get("mode") === "snapshot") {
    const { snapshot } = await collectSystemTelemetry();
    recordApiMetric({
      route: "/api/admin/system/telemetry",
      method: "GET",
      status: 200,
      durationMs: performance.now() - startedAt,
      source: "server",
    });
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const intervalMs = clampIntervalMs(url.searchParams.get("interval"));
  const encoder = new TextEncoder();

  let timer: ReturnType<typeof setInterval> | null = null;
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let prevCpuTicks: CpuTickSnapshot | null = null;
  let prevNetTicks: NetworkTickSnapshot | null = null;

  const clearTimers = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const pushSample = async () => {
        if (closed) return;
        try {
          const { snapshot, cpuTicks, netTicks } = await collectSystemTelemetry(prevCpuTicks, prevNetTicks);
          prevCpuTicks = cpuTicks;
          prevNetTicks = netTicks;
          if (!closed) {
            controller.enqueue(encoder.encode(`event: telemetry\ndata: ${JSON.stringify(snapshot)}\n\n`));
          }
        } catch {
          // Ignore transient sampling errors so stream stays healthy
        }
      };

      // Emit initial heartbeat comment + immediate first reading
      controller.enqueue(encoder.encode(`: connected\n\n`));
      await pushSample();

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearTimers();
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      };

      timer = setInterval(() => {
        void pushSample();
      }, intervalMs);

      // Guard shared-host Entry Process limits by capping any SSE connection to 45s
      maxDurationTimer = setTimeout(cleanup, 45_000);

      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      closed = true;
      clearTimers();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
