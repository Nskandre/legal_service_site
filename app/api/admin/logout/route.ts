import { clearSessionCookie, sameOrigin } from "../../../lib/admin-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
