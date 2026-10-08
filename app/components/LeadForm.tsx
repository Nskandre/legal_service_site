"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { contacts } from "../lib/content";
import { getLeadAttribution } from "../lib/lead-attribution";
import type { SiteConfig } from "../lib/site-config";
import { metrikaGoal } from "./Metrika";

type LeadFormProps = {
  service?: string;
  compact?: boolean;
  submitLabel?: string;
  contactDetails?: SiteConfig["contacts"];
};

export function LeadForm({ service = "Первичная консультация", compact, submitLabel = "Получить разбор ситуации", contactDetails = contacts }: LeadFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus("sending");
    const form = new FormData(formElement);
    const payload = { ...Object.fromEntries(form.entries()), ...getLeadAttribution() };
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("request failed");
      metrikaGoal("lead_success", { service });
      setStatus("sent");
    } catch {
      metrikaGoal("lead_error", { service });
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className={`lead-success ${compact ? "lead-success--compact" : ""}`} role="status" aria-live="polite">
        <strong>Заявка отправлена</strong>
        <p>Я свяжусь с вами в ближайшее рабочее время.</p>
      </div>
    );
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
          <Link href="/politika">политике конфиденциальности</Link>
        </span>
      </label>
      <button className="button button--primary" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Отправляем…" : submitLabel}
      </button>
      <p className="form-note" aria-live="polite">
        {status === "error" && (
          <>
            Не удалось отправить форму. Напишите на{" "}
            <a href={`mailto:${contactDetails.email}`}>{contactDetails.email}</a> или позвоните{" "}
            <a href={`tel:${contactDetails.phone}`}>{contactDetails.phoneDisplay}</a>.
          </>
        )}
        {status === "idle" && "Ответ — в ближайшее рабочее время. Без навязчивых звонков."}
      </p>
    </form>
  );
}
