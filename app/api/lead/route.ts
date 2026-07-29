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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    return Response.json(
      { ok: false, error: "Заполните обязательные поля и подтвердите согласие" },
      { status: 422 },
    );
  }

  const text = [
    "Новая заявка с сайта",
    `Услуга: ${service}`,
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    `Сообщение: ${message}`,
    `Время: ${new Date().toISOString()}`,
  ].join("\n");

  const deliveries: Promise<Response>[] = [];

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    deliveries.push(
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
      }),
    );
  }

  if (
    process.env.RESEND_API_KEY &&
    process.env.LEAD_EMAIL_TO &&
    process.env.LEAD_EMAIL_FROM
  ) {
    deliveries.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.LEAD_EMAIL_FROM,
          to: [process.env.LEAD_EMAIL_TO],
          subject: `Заявка: ${service}`,
          text,
          html: `<h2>Новая заявка с сайта</h2><p><b>Услуга:</b> ${escapeHtml(service)}</p><p><b>Имя:</b> ${escapeHtml(name)}</p><p><b>Контакт:</b> ${escapeHtml(contact)}</p><p><b>Сообщение:</b><br>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`,
        }),
      }),
    );
  }

  if (process.env.SMSRU_API_ID && process.env.LEAD_SMS_TO) {
    const sms = new URLSearchParams({
      api_id: process.env.SMSRU_API_ID,
      to: process.env.LEAD_SMS_TO,
      msg: text.slice(0, 700),
      json: "1",
    });
    deliveries.push(fetch(`https://sms.ru/sms/send?${sms.toString()}`));
  }

  if (process.env.LEAD_WEBHOOK_URL) {
    deliveries.push(
      fetch(process.env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.LEAD_WEBHOOK_TOKEN
            ? { authorization: `Bearer ${process.env.LEAD_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({ name, contact, message, service, source: "website" }),
      }),
    );
  }

  if (!deliveries.length) {
    return Response.json(
      { ok: false, error: "Каналы доставки еще не настроены" },
      { status: 503 },
    );
  }

  const results = await Promise.allSettled(deliveries);
  const delivered = results.some(
    (result) => result.status === "fulfilled" && result.value.ok,
  );

  if (!delivered) {
    return Response.json(
      { ok: false, error: "Не удалось доставить заявку" },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
