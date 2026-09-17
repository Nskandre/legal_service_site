"use client";

import { FormEvent, useState } from "react";
import { contacts } from "../lib/content";

type LeadFormProps = {
  service?: string;
  compact?: boolean;
};

export function LeadForm({ service = "Первичная консультация", compact }: LeadFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("request failed");
      setStatus("sent");
      event.currentTarget.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className={`lead-form ${compact ? "lead-form--compact" : ""}`} onSubmit={submit}>
      <input type="hidden" name="service" value={service} />
      <label className="honeypot" aria-hidden="true">
        Не заполняйте это поле
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div className="field-grid">
        <label>
          <span>Ваше имя</span>
          <input name="name" autoComplete="name" required placeholder="Как к вам обращаться" />
        </label>
        <label>
          <span>Телефон, email или мессенджер</span>
          <input
            name="contact"
            autoComplete="tel"
            required
            placeholder="Телефон, email, Telegram или MAX"
          />
        </label>
      </div>
      {!compact && (
        <label>
          <span>Коротко о ситуации</span>
          <textarea
            name="message"
            rows={4}
            required
            placeholder="Что произошло и какой результат вам нужен?"
          />
        </label>
      )}
      <label className="consent">
        <input type="checkbox" name="consent" value="yes" required />
        <span>
          Согласен(на) на обработку персональных данных согласно{" "}
          <a href="/politika">политике конфиденциальности</a>
        </span>
      </label>
      <button className="button button--primary" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Отправляем…" : "Получить разбор ситуации"}
      </button>
      <p className="form-note" aria-live="polite">
        {status === "sent" &&
          "Заявка отправлена. Я свяжусь с вами в ближайшее рабочее время."}
        {status === "error" && (
          <>
            Не удалось отправить форму. Напишите на{" "}
            <a href={`mailto:${contacts.email}`}>{contacts.email}</a> или позвоните{" "}
            <a href={`tel:${contacts.phone}`}>{contacts.phoneDisplay}</a>.
          </>
        )}
        {status === "idle" && "Ответ — в ближайшее рабочее время. Без навязчивых звонков."}
      </p>
    </form>
  );
}
