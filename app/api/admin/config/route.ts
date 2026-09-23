import { isAdmin, sameOrigin } from "../../../lib/admin-auth";
import { getSiteConfig, saveSiteConfig } from "../../../lib/site-config";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ ok: false }, { status: 401, headers: noStore });
  return Response.json({ ok: true, config: await getSiteConfig() }, { headers: noStore });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403, headers: noStore });
  if (!(await isAdmin(request))) return Response.json({ ok: false }, { status: 401, headers: noStore });
  try {
    const config = await saveSiteConfig(await request.json());
    return Response.json({ ok: true, config }, { headers: noStore });
  } catch {
    return Response.json({ ok: false, error: "Не удалось сохранить настройки" }, { status: 500, headers: noStore });
  }
}
