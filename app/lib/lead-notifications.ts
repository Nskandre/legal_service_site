import nodemailer from "nodemailer";
import {
  databaseConfigured,
  markDeliveryFailed,
  markDeliverySent,
  pendingDeliveries,
  queueDelivery,
  type DeliveryChannel,
} from "@runtime/database";

type PendingDelivery = {
  id: number;
  channel: DeliveryChannel;
  attempts: number;
  public_number: string;
};

export function configuredDeliveryChannels(): DeliveryChannel[] {
  const channels: DeliveryChannel[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) channels.push("telegram");
  if (process.env.MAX_BOT_TOKEN && process.env.MAX_CHAT_ID) channels.push("max");
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.LEAD_NOTIFICATION_EMAIL
  ) channels.push("email");
  if (process.env.LEAD_WEBHOOK_URL) channels.push("webhook");
  return channels;
}

export async function enqueueLeadNotifications(leadId: string) {
  for (const channel of configuredDeliveryChannels()) await queueDelivery(leadId, channel);
}

function adminUrl() {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";
  return base ? base + "/upravlenie" : "/upravlenie";
}

async function deliver(item: PendingDelivery) {
  const text = "Новая заявка №" + item.public_number +
    "\nОткройте защищённый журнал: " + adminUrl();
  if (item.channel === "telegram") {
    return fetch("https://api.telegram.org/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
    });
  }
  if (item.channel === "max") {
    const url = new URL("https://platform-api2.max.ru/messages");
    url.searchParams.set("chat_id", process.env.MAX_CHAT_ID || "");
    return fetch(url, {
      method: "POST",
      headers: { authorization: process.env.MAX_BOT_TOKEN || "", "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }
  if (item.channel === "email") {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== "false",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.LEAD_NOTIFICATION_EMAIL,
      subject: "Новая заявка с сайта №" + item.public_number,
      text,
    });
    return new Response(null, { status: 204 });
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
  flushing = true;
  try {
    const items = await pendingDeliveries(20) as unknown as PendingDelivery[];
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
