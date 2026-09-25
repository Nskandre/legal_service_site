import { after } from "next/server";
import { requestClientKey } from "../../lib/admin-auth";
import { consumeDatabaseRateLimit, createLead, databaseConfigured } from "@runtime/database";
import { enqueueLeadNotifications, flushPendingNotifications } from "../../lib/lead-notifications";

type Lead = {
  name?: string;
  contact?: string;
  message?: string;
  service?: string;
  consent?: string;
  website?: string;
};

function clean(value: unknown, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

async function cloudflareNotification() {
  const text = "На сайте получена новая заявка. Персональные данные в уведомление не включены.";
  const deliveries: Promise<Response>[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    deliveries.push(fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    }));
  }
  if (process.env.LEAD_WEBHOOK_URL) {
    deliveries.push(fetch(process.env.LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.LEAD_WEBHOOK_TOKEN ? { authorization: "Bearer " + process.env.LEAD_WEBHOOK_TOKEN } : {}),
      },
      body: JSON.stringify({ event: "new_lead" }),
    }));
  }
  if (!deliveries.length) return false;
  const results = await Promise.allSettled(deliveries);
  return results.some((result) => result.status === "fulfilled" && result.value.ok);
}

export async function POST(request: Request) {
  let body: Lead;
  try {
    body = (await request.json()) as Lead;
  } catch {
    return Response.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }
  if (body.website) return Response.json({ ok: true });
  const name = clean(body.name, 120);
  const contact = clean(body.contact, 180);
  const message = clean(body.message || "Не указано");
  const service = clean(body.service || "Первичная консультация", 180);
  if (!name || !contact || body.consent !== "yes") {
    return Response.json({ ok: false, error: "Заполните обязательные поля и подтвердите согласие" }, { status: 422 });
  }
  if (!databaseConfigured()) {
    return (await cloudflareNotification())
      ? Response.json({ ok: true })
      : Response.json({ ok: false, error: "Канал уведомлений не настроен" }, { status: 503 });
  }
  const clientKey = await requestClientKey(request);
  if (!(await consumeDatabaseRateLimit("lead:" + clientKey, 8, 900))) {
    return Response.json({ ok: false, error: "Слишком много заявок. Повторите позже" }, { status: 429 });
  }
  let lead: Awaited<ReturnType<typeof createLead>>;
  try {
    lead = await createLead({
      name,
      contact,
      message,
      service,
      source: service === "Запись на консультацию" ? "booking" : "website",
      ipHash: clientKey,
    });
  } catch {
    return Response.json({ ok: false, error: "Не удалось сохранить заявку" }, { status: 503 });
  }
  try {
    await enqueueLeadNotifications(lead.id);
    after(async () => {
      await flushPendingNotifications();
    });
  } catch {
    // The lead is already safe in PostgreSQL. A notification failure must not
    // make the visitor submit the same personal data a second time.
  }
  return Response.json({ ok: true, number: lead.public_number });
}
