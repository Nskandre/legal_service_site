import { isAdmin, sameOrigin } from "../../../lib/admin-auth";
import {
  anonymizeExpiredLeads,
  anonymizeLead,
  databaseConfigured,
  deleteTestLead,
  listLeads,
  updateLead,
  type LeadStatus,
} from "@runtime/database";

const noStore = { "cache-control": "no-store" };
const statuses = new Set<LeadStatus>(["new", "in_progress", "done", "declined"]);

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
  const lead = await updateLead(
    id,
    body.status as LeadStatus,
    typeof body.notes === "string" ? body.notes : "",
  );
  return lead
    ? Response.json({ ok: true, lead }, { headers: noStore })
    : Response.json({ ok: false }, { status: 404, headers: noStore });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403, headers: noStore });
  if (!(await isAdmin(request))) return Response.json({ ok: false }, { status: 401, headers: noStore });
  if (!databaseConfigured()) return Response.json({ ok: false }, { status: 503, headers: noStore });
  const body = await request.json().catch(() => ({})) as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return Response.json({ ok: false }, { status: 400, headers: noStore });
  const deleted = await deleteTestLead(id);
  return deleted
    ? Response.json({ ok: true }, { headers: noStore })
    : Response.json({ ok: false }, { status: 404, headers: noStore });
}
