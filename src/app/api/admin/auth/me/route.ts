import { NextResponse } from "next/server";
import { getVerifiedLiveSession, unauthorized } from "@/lib/session";
import { CSRF_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getVerifiedLiveSession();
  if (!session) return unauthorized();

  const store = await cookies();
  const csrfToken = store.get(CSRF_COOKIE)?.value ?? null;

  return NextResponse.json(
    {
      user: { id: session.sub, name: session.name, email: session.email, role: session.role },
      csrfToken,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
