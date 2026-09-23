import { adminConfigured, createSessionCookie, passwordMatches, sameOrigin } from "../../../lib/admin-auth";
import { workerBindings } from "../../../lib/site-config";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (!adminConfigured()) {
    return Response.json({ ok: false, error: "Страница управления ещё не настроена" }, { status: 503 });
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rateKey = `admin-login:${ip}`;
  const kv = workerBindings().SITE_CONFIG!;
  const attempts = Number((await kv.get(rateKey, "json")) || 0);
  if (attempts >= 10) {
    return Response.json({ ok: false, error: "Слишком много попыток. Повторите позже" }, { status: 429 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password.slice(0, 256) : "";
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!(await passwordMatches(password))) {
    await kv.put(rateKey, JSON.stringify(attempts + 1), { expirationTtl: 900 });
    return Response.json({ ok: false, error: "Неверный пароль" }, { status: 401 });
  }

  await kv.delete(rateKey);
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": await createSessionCookie(), "cache-control": "no-store" } },
  );
}
