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
