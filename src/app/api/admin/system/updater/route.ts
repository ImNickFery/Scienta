import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, requireAdminMutation, badRequest } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import { getClientIp } from "@/lib/rate-limit";
import {
  checkGithubForUpdates,
  getActiveDeployJob,
  getDeployHistory,
  getLocalGitStatus,
  getSshKeyStatus,
  getUpdaterConfig,
  saveUpdaterConfig,
  startSiteUpdateJob,
} from "@/lib/system-updater";

export const dynamic = "force-dynamic";

const saveConfigSchema = z.object({
  repoUrl: z.string().trim().min(1).max(300),
  branch: z.string().trim().min(1).max(120),
  visibility: z.enum(["public", "private"]),
  autoInstallDeps: z.boolean().optional(),
  autoBuild: z.boolean().optional(),
  autoOptimizeDb: z.boolean().optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("check"),
    repoUrl: z.string().trim().max(300).optional(),
    branch: z.string().trim().max(120).optional(),
    visibility: z.enum(["public", "private"]).optional(),
  }),
  z.object({
    action: z.literal("update"),
  }),
]);

export async function GET() {
  const { response } = await requireApiAuth("settings.manage");
  if (response) return response;

  const [config, localGit, sshKey, history] = await Promise.all([
    getUpdaterConfig(),
    getLocalGitStatus(),
    getSshKeyStatus(),
    getDeployHistory(),
  ]);

  return NextResponse.json(
    {
      config,
      localGit,
      sshKey,
      activeJob: getActiveDeployJob(),
      history,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function PUT(req: Request) {
  const { session, response } = await requireAdminMutation(req, "settings.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = saveConfigSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid repository configuration", parsed.error.flatten());
  }

  const saved = await saveUpdaterConfig(parsed.data);
  if (!saved.ok) {
    return badRequest(saved.error);
  }

  await logActivity({
    userId: session!.sub,
    action: "system.updater.config.save",
    entityType: "system",
    entityId: saved.config.branch,
    meta: {
      repoUrl: saved.config.repoUrl,
      branch: saved.config.branch,
      visibility: saved.config.visibility,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(
    { config: saved.config },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const { session, response } = await requireAdminMutation(req, "settings.manage");
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid updater action", parsed.error.flatten());
  }

  if (parsed.data.action === "check") {
    const result = await checkGithubForUpdates({
      repoUrl: parsed.data.repoUrl,
      branch: parsed.data.branch,
      visibility: parsed.data.visibility,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const started = await startSiteUpdateJob(session!.email || session!.name || "admin");
  if (!started.ok) {
    return NextResponse.json(
      { error: started.error },
      { status: started.statusCode, headers: { "Cache-Control": "no-store" } }
    );
  }

  await logActivity({
    userId: session!.sub,
    action: "system.updater.deploy.start",
    entityType: "system",
    entityId: started.job.id,
    meta: {
      repoUrl: started.job.repoUrl,
      branch: started.job.branch,
      visibility: started.job.visibility,
    },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(
    { job: started.job },
    { status: 202, headers: { "Cache-Control": "no-store" } }
  );
}
