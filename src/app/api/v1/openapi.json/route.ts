import { NextResponse } from "next/server";
import { getPublicOrigin, v1CorsPreflight, v1Headers } from "@/lib/ai-api-auth";
import { generateOpenApiSpec } from "@/lib/ai-api-articles";

export async function OPTIONS(req: Request) {
  return v1CorsPreflight(req, { publicCors: true });
}

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  const spec = generateOpenApiSpec(origin);
  return NextResponse.json(spec, {
    status: 200,
    headers: v1Headers(
      {
        "Cache-Control": "public, max-age=300",
      },
      { req, publicCors: true }
    ),
  });
}
