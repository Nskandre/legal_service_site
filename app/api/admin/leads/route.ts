import { after } from "next/server";
import { isAdmin, sameOrigin } from "../../../lib/admin-auth";
import { configuredDeliveryChannels } from "../../../lib/notification-channels";
import { flushPendingNotifications } from "../../../lib/lead-notifications";
import type { ConsultationStatus, ContractStatus, LeadQualification } from "../../../lib/lead-economics";
import {
  anonymizeExpiredLeads,
  anonymizeLead,
  databaseConfigured,
  deleteLeads,
  listLeads,
  retryTestDeliveries,
  updateLead,
  type LeadStatus,
} from "@runtime/database";

const noStore = { "cache-control": "no-store" };
const statuses = new Set<LeadStatus>(["new", "in_progress", "done", "declined"]);
const qualifications = new Set<LeadQualification>(["unreviewed", "target", "non_target"]);
const consultationStatuses = new Set<ConsultationStatus>(["unreviewed", "held", "not_held"]);
const contractStatuses = new Set<ContractStatus>(["unreviewed", "signed", "not_signed"]);

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ ok: false }, { status: 401, headers: noStore });
  if (!databaseConfigured()) return Response.json({ ok: true, leads: [] }, { headers: noStore });
  const retentionDays = Number(process.env.LEAD_RETENTION_DAYS || 0);
  if (retentionDays > 0) await anonymizeExpiredLeads(retentionDays);
  const url = new URL(request.url);
  const leads = await listLeads({
    query: url.searchParams.get("q") || "",
    status: url.searchParams.get("status") || "",
  });
  return Response.json({ ok: true, leads }, { headers: noStore });
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403, headers: noStore });
  if (!(await isAdmin(request))) return Response.json({ ok: false }, { status: 401, headers: noStore });
  if (!databaseConfigured()) return Response.json({ ok: false }, { status: 503, headers: noStore });
  const body = await request.json().catch(() => ({})) as {
    id?: unknown;
    status?: unknown;
    notes?: unknown;
    qualification?: unknown;
    consultationStatus?: unknown;
    contractStatus?: unknown;
    revenueRub?: unknown;
    action?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ ok: false }, { status: 400, headers: noStore });
  if (body.action === "anonymize") {
    return Response.json({ ok: await anonymizeLead(id) }, { headers: noStore });
  }
  if (typeof body.status !== "string" || !statuses.has(body.status as LeadStatus)) {
    return Response.json({ ok: false }, { status: 422, headers: noStore });
  }
  if (typeof body.qualification !== "string" || !qualifications.has(body.qualification as LeadQualification)
    || typeof body.consultationStatus !== "string"
    || !consultationStatuses.has(body.consultationStatus as ConsultationStatus)
    || typeof body.contractStatus !== "string"
    || !contractStatuses.has(body.contractStatus as ContractStatus)
    || typeof body.revenueRub !== "number" || !Number.isFinite(body.revenueRub)
    || body.revenueRub < 0 || body.revenueRub > 100_000_000
    || Math.abs(Math.round(body.revenueRub * 100) - body.revenueRub * 100) > 1e-7) {
    return Response.json({ ok: false }, { status: 422, headers: noStore });
  }
  const lead = await updateLead({
    id,
    status: body.status as LeadStatus,
    notes: typeof body.notes === "string" ? body.notes : "",
    qualification: body.qualification as LeadQualification,
    consultationStatus: body.consultationStatus as ConsultationStatus,
    contractStatus: body.contractStatus as ContractStatus,
    revenueRub: body.revenueRub,
  });
  return lead
    ? Response.json({ ok: true, lead }, { headers: noStore })
    : Response.json({ ok: false }, { status: 404, headers: noStore });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403, headers: noStore });
  if (!(await isAdmin(request))) return Response.json({ ok: false }, { status: 401, headers: noStore });
  if (!databaseConfigured()) return Response.json({ ok: false }, { status: 503, headers: noStore });
  const body = await request.json().catch(() => ({})) as { ids?: unknown; resetCounter?: unknown };
  const resetCounter = body.resetCounter === true;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!Array.isArray(body.ids) || body.ids.length > 100 || (!body.ids.length && !resetCounter)) {
    return Response.json({ ok: false }, { status: 400, headers: noStore });
  }
  const ids = [...new Set(body.ids)];
  if (!ids.every((id): id is string => typeof id === "string" && uuidPattern.test(id))) {
    return Response.json({ ok: false }, { status: 400, headers: noStore });
  }
  const result = await deleteLeads(ids, resetCounter);
  if (resetCounter && !result.counterReset) {
    return Response.json({ ok: false, ...result, error: "journal_not_empty" }, { status: 409, headers: noStore });
  }
  return Response.json({ ok: true, ...result }, { headers: noStore });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403, headers: noStore });
  if (!(await isAdmin(request))) return Response.json({ ok: false }, { status: 401, headers: noStore });
  if (!databaseConfigured()) return Response.json({ ok: false }, { status: 503, headers: noStore });
  const channels = configuredDeliveryChannels();
  const queued = await retryTestDeliveries(channels);
  after(async () => {
    await flushPendingNotifications();
  });
  return Response.json({ ok: true, queued }, { headers: noStore });
}
