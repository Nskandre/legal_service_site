import { databaseConfigured, databaseHealth } from "@runtime/database";

export async function GET() {
  if (!databaseConfigured()) return Response.json({ ok: true, storage: "cloudflare" });
  const healthy = await databaseHealth();
  return Response.json(
    { ok: healthy, storage: "postgresql" },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
