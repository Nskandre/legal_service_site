import { adminConfigured, createSessionCookie, passwordMatches, requestClientKey, sameOrigin } from "../../../lib/admin-auth";
import { workerBindings } from "../../../lib/site-config";
import {
  clearDatabaseRateLimit,
  consumeDatabaseRateLimit,
  databaseConfigured,
} from "@runtime/database";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  if (!adminConfigured()) {
    return Response.json({ ok: false, error: "Страница управления ещё не настроена" }, { status: 503 });
  }

  const rateKey = `admin-login:${await requestClientKey(request)}`;
  const kv = workerBindings().SITE_CONFIG;
  if (databaseConfigured()) {
    if (!(await consumeDatabaseRateLimit(rateKey, 10, 900))) {
      return Response.json({ ok: false, error: "Слишком много попыток. Повторите позже" }, { status: 429 });
    }
  } else {
    const attempts = Number((await kv!.get(rateKey, "json")) || 0);
    if (attempts >= 10) {
      return Response.json({ ok: false, error: "Слишком много попыток. Повторите позже" }, { status: 429 });
    }
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password.slice(0, 256) : "";
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!(await passwordMatches(password))) {
    if (!databaseConfigured()) {
      const attempts = Number((await kv!.get(rateKey, "json")) || 0);
      await kv!.put(rateKey, JSON.stringify(attempts + 1), { expirationTtl: 900 });
    }
    return Response.json({ ok: false, error: "Неверный пароль" }, { status: 401 });
  }

  if (databaseConfigured()) await clearDatabaseRateLimit(rateKey);
  else await kv!.delete(rateKey);
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": await createSessionCookie(), "cache-control": "no-store" } },
  );
}
