import {
  databaseConfigured,
  markDeliveryFailed,
  markDeliverySent,
  pendingDeliveries,
  queueDelivery,
  type DeliveryChannel,
} from "@runtime/database";
import { configuredDeliveryChannels, requestWithRetry } from "./notification-channels";
import { sendSmtpEmail } from "./smtp-email";

type PendingDelivery = {
  id: number;
  channel: DeliveryChannel;
  attempts: number;
  public_number: string;
  name: string;
  contact: string;
  message: string;
  service: string;
  source: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  created_at: string;
};

export type LeadEmailDetails = Pick<PendingDelivery,
  "public_number" | "name" | "contact" | "message" | "service" | "source" |
  "landing_page" | "referrer" | "utm_source" | "utm_medium" | "utm_campaign" |
  "utm_content" | "utm_term" | "created_at"
>;

export async function enqueueLeadNotifications(leadId: string) {
  for (const channel of configuredDeliveryChannels()) await queueDelivery(leadId, channel);
}

function adminUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";
  return base ? base + "/upravlenie" : "/upravlenie";
}

export function formatLeadEmailText(lead: LeadEmailDetails) {
  const createdAt = new Date(lead.created_at);
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? lead.created_at
    : new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Moscow",
    }).format(createdAt) + " МСК";
  const utm = [
    lead.utm_source ? "source=" + lead.utm_source : "",
    lead.utm_medium ? "medium=" + lead.utm_medium : "",
    lead.utm_campaign ? "campaign=" + lead.utm_campaign : "",
    lead.utm_content ? "content=" + lead.utm_content : "",
    lead.utm_term ? "term=" + lead.utm_term : "",
  ].filter(Boolean).join("; ") || "не определены";
  return [
    "Новая заявка №" + lead.public_number,
    "Дата: " + createdLabel,
    "Услуга: " + lead.service,
    "Тип формы: " + (lead.source === "booking" ? "Запись на консультацию" : "Форма сайта"),
    "Точка входа: " + (lead.landing_page || "не определена"),
    "Referrer: " + (lead.referrer || "не определён"),
    "UTM: " + utm,
    "Имя: " + lead.name,
    "Контакт: " + lead.contact,
    "",
    "Сообщение:",
    lead.message || "Не указано",
    "",
    "Защищённый журнал: " + adminUrl(),
  ].join("\n");
}

async function deliver(item: PendingDelivery) {
  const text = "Новая заявка №" + item.public_number +
    "\nОткройте защищённый журнал: " + adminUrl();
  if (item.channel === "telegram") {
    return requestWithRetry(() => fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    }));
  }
  if (item.channel === "max") {
    const url = new URL("https://platform-api2.max.ru/messages");
    url.searchParams.set("chat_id", process.env.MAX_CHAT_ID || "");
    return requestWithRetry(() => fetch(url, {
      method: "POST",
      headers: { authorization: process.env.MAX_BOT_TOKEN || "", "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }));
  }
  if (item.channel === "email") {
    return sendEmailNotification({
      subject: "Новая заявка №" + item.public_number,
      text: formatLeadEmailText(item),
      messageId: `legservice-lead-${item.public_number}-delivery-${item.id}`,
    });
  }
  return fetch(process.env.LEAD_WEBHOOK_URL || "", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.LEAD_WEBHOOK_TOKEN ? { authorization: "Bearer " + process.env.LEAD_WEBHOOK_TOKEN } : {}),
    },
    body: JSON.stringify({ number: item.public_number, adminUrl: adminUrl() }),
  });
}

export async function sendEmailNotification({ subject, text, messageId }: {
  subject: string;
  text: string;
  messageId?: string;
}) {
  if (process.env.DASHAMAIL_API_KEY && process.env.EMAIL_FROM && process.env.LEAD_NOTIFICATION_EMAIL) {
    return requestWithRetry(() => fetch("https://api.dashamail.com/v2/transactional/messages", {
      method: "POST",
      headers: {
        authorization: "Bearer " + (process.env.DASHAMAIL_API_KEY || ""),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: process.env.LEAD_NOTIFICATION_EMAIL,
        from_email: process.env.EMAIL_FROM,
        from_name: process.env.EMAIL_FROM_NAME || "Сайт legservice.ru",
        subject,
        plain_text: text,
        message_id: messageId,
      }),
    }));
  }
  return sendSmtpEmail({ subject, text, messageId });
}

function deliveryErrorMessage(error: unknown) {
  const details = [error instanceof Error ? error.message : String(error)];
  const cause = error instanceof Error
    ? (error as Error & { cause?: unknown }).cause
    : undefined;
  if (cause && typeof cause === "object") {
    const data = cause as { code?: unknown; message?: unknown; address?: unknown; port?: unknown };
    for (const [label, value] of Object.entries({
      cause: data.message,
      code: data.code,
      address: data.address,
      port: data.port,
    })) {
      if (typeof value === "string" || typeof value === "number") details.push(label + "=" + value);
    }
  }
  return details.join(" | ");
}

let flushing = false;

export async function flushPendingNotifications() {
  if (!databaseConfigured() || flushing) return;
  const channels = configuredDeliveryChannels();
  if (!channels.length) return;
  flushing = true;
  try {
    const items = await pendingDeliveries(channels, 20) as unknown as PendingDelivery[];
    for (const item of items) {
      try {
        const response = await deliver(item);
        if (!response.ok) throw new Error("HTTP " + response.status);
        await markDeliverySent(item.id);
      } catch (error) {
        await markDeliveryFailed(item.id, item.attempts, deliveryErrorMessage(error));
      }
    }
  } finally {
    flushing = false;
  }
}
