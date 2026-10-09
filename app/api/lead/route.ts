import { after } from "next/server";
import { requestClientKey } from "../../lib/admin-auth";
import { configuredDeliveryChannels } from "../../lib/notification-channels";
import {
  BookingSlotUnavailableError,
  consumeDatabaseRateLimit,
  createBookingLead,
  createLead,
  databaseConfigured,
} from "@runtime/database";
import {
  enqueueLeadNotifications,
  flushPendingNotifications,
  formatLeadEmailText,
  sendEmailNotification,
} from "../../lib/lead-notifications";

type Lead = {
  name?: string;
  contact?: string;
  message?: string;
  service?: string;
  consent?: string;
  website?: string;
  landingPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  bookingDate?: string;
  bookingTime?: string;
  bookingMethod?: string;
};

function clean(value: unknown, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function cleanAttribution(value: unknown, max = 180) {
  return clean(value, max).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function cleanLandingPage(value: unknown) {
  const path = cleanAttribution(value, 500);
  if (!path.startsWith("/") || path.startsWith("//")) return "";
  return path.split(/[?#]/, 1)[0];
}

function cleanReferrer(value: unknown, siteOrigin: string) {
  const raw = cleanAttribution(value, 500);
  if (!raw) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw.split(/[?#]/, 1)[0];
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin === siteOrigin ? url.pathname : url.origin;
  } catch {
    return "";
  }
}

async function directNotification(lead: {
  name: string;
  contact: string;
  message: string;
  service: string;
  source: string;
  landing_page: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
}) {
  const text = "На сайте получена новая заявка. Персональные данные в уведомление не включены.";
  const deliveries: Promise<Response>[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    deliveries.push(fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    }));
  }
  if (process.env.MAX_BOT_TOKEN && process.env.MAX_CHAT_ID) {
    const url = new URL("https://platform-api2.max.ru/messages");
    url.searchParams.set("chat_id", process.env.MAX_CHAT_ID);
    deliveries.push(fetch(url, {
      method: "POST",
      headers: { authorization: process.env.MAX_BOT_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }));
  }
  if (configuredDeliveryChannels().includes("email")) {
    deliveries.push(sendEmailNotification({
      subject: "Новая заявка с сайта",
      text: formatLeadEmailText({
        public_number: "без номера",
        created_at: new Date().toISOString(),
        ...lead,
      }),
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
  const service = clean(body.service || "Первичная консультация", 180);
  const source = service === "Запись на консультацию" ? "booking" : "website";
  const bookingSlot = {
    date: clean(body.bookingDate, 10),
    time: clean(body.bookingTime, 5),
  };
  const bookingMethod = clean(body.bookingMethod, 180);
  if (source === "booking" && (
    !/^\d{4}-\d{2}-\d{2}$/.test(bookingSlot.date) ||
    !/^\d{2}:\d{2}$/.test(bookingSlot.time) ||
    !bookingMethod
  )) {
    return Response.json({ ok: false, error: "Выберите доступные дату, время и формат встречи" }, { status: 422 });
  }
  const message = source === "booking"
    ? `Дата: ${bookingSlot.date}; время: ${bookingSlot.time}; формат: ${bookingMethod}`
    : clean(body.message || "Не указано");
  const attribution = {
    landing_page: cleanLandingPage(body.landingPage),
    referrer: cleanReferrer(body.referrer, new URL(request.url).origin),
    utm_source: cleanAttribution(body.utmSource),
    utm_medium: cleanAttribution(body.utmMedium),
    utm_campaign: cleanAttribution(body.utmCampaign),
    utm_content: cleanAttribution(body.utmContent),
    utm_term: cleanAttribution(body.utmTerm),
  };
  if (!name || !contact || body.consent !== "yes") {
    return Response.json({ ok: false, error: "Заполните обязательные поля и подтвердите согласие" }, { status: 422 });
  }
  if (!databaseConfigured()) {
    return (await directNotification({ name, contact, message, service, source, ...attribution }))
      ? Response.json({ ok: true })
      : Response.json({ ok: false, error: "Канал уведомлений не настроен" }, { status: 503 });
  }
  const clientKey = await requestClientKey(request);
  if (!(await consumeDatabaseRateLimit("lead:" + clientKey, 8, 900))) {
    return Response.json({ ok: false, error: "Слишком много заявок. Повторите позже" }, { status: 429 });
  }
  let lead: Awaited<ReturnType<typeof createLead>>;
  try {
    const leadInput = {
      name,
      contact,
      message,
      service,
      source,
      ...attribution,
      ipHash: clientKey,
    };
    lead = source === "booking"
      ? await createBookingLead(leadInput, bookingSlot)
      : await createLead(leadInput);
  } catch (error) {
    if (error instanceof BookingSlotUnavailableError) {
      return Response.json(
        { ok: false, error: "Этот слот уже занят. Обновите страницу и выберите другое время." },
        { status: 409 },
      );
    }
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
