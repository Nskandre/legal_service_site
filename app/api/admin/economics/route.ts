import { isAdmin, sameOrigin } from "../../../lib/admin-auth";
import { normalizeMarketingChannel } from "../../../lib/lead-economics";
import { databaseConfigured, getWeeklyEconomics, saveMarketingCost } from "@runtime/database";

const noStore = { "cache-control": "no-store" };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validWeekStart(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf())
    && date.toISOString().slice(0, 10) === value
    && date.getUTCDay() === 1;
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ ok: false }, { status: 401, headers: noStore });
  }
  if (!databaseConfigured()) {
    return Response.json({ ok: false }, { status: 503, headers: noStore });
  }
  const weekStart = new URL(request.url).searchParams.get("week");
  if (!validWeekStart(weekStart)) {
    return Response.json({ ok: false, error: "invalid_week" }, { status: 422, headers: noStore });
  }
  const economics = await getWeeklyEconomics(weekStart);
  return Response.json({ ok: true, economics }, { headers: noStore });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ ok: false }, { status: 403, headers: noStore });
  }
  if (!(await isAdmin(request))) {
    return Response.json({ ok: false }, { status: 401, headers: noStore });
  }
  if (!databaseConfigured()) {
    return Response.json({ ok: false }, { status: 503, headers: noStore });
  }
  const body = await request.json().catch(() => ({})) as {
    weekStart?: unknown;
    channel?: unknown;
    spendRub?: unknown;
  };
  const channel = typeof body.channel === "string" ? normalizeMarketingChannel(body.channel) : "";
  if (!validWeekStart(body.weekStart) || !channel
    || typeof body.spendRub !== "number" || !Number.isFinite(body.spendRub)
    || body.spendRub < 0 || body.spendRub > 100_000_000
    || Math.abs(Math.round(body.spendRub * 100) - body.spendRub * 100) > 1e-7) {
    return Response.json({ ok: false }, { status: 422, headers: noStore });
  }
  const cost = await saveMarketingCost(body.weekStart, channel, body.spendRub);
  return Response.json({ ok: true, cost }, { headers: noStore });
}
