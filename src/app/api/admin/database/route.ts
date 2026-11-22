import { NextResponse } from "next/server";
import { requireApiAuth, requireAdminMutation } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import { getDatabaseDiagnostics, runDatabaseMaintenance } from "@/lib/db-optimizer";

export async function GET() {
  const { response } = await requireApiAuth("cache.manage");
  if (response) return response;

  const diagnostics = await getDatabaseDiagnostics();
  return NextResponse.json(diagnostics, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "cache.manage");
  if (response) return response;

  const result = await runDatabaseMaintenance();

  await logActivity({
    userId: session!.sub,
    action: "database.maintenance.run",
    entityType: "database",
    entityId: result.engine,
    meta: {
      prunedExpiredRefreshTokens: result.prunedExpiredRefreshTokens,
      prunedExpiredIdempotencyKeys: result.prunedExpiredIdempotencyKeys,
      analyzed: result.sqlite?.analyzed ?? Boolean(result.mysql?.analyzedTables),
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
