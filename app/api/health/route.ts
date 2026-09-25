import { databaseConfigured } from "@runtime/database";

export async function GET() {
  return Response.json(
    { ok: true, storage: databaseConfigured() ? "postgresql" : "cloudflare" },
    { headers: { "cache-control": "no-store" } },
  );
}
