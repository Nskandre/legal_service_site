"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { SiteConfig } from "../lib/site-config";

const noSlotsMessage = "Свободных слотов для записи пока нет, но вы всегда можете связаться со мной любым удобным для Вас способом и согласовать дату и время встречи.";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function BookingForm({ config }: { config: SiteConfig }) {
  const slots = config.bookingSlots;
  const first = slots[0]?.date ? new Date(`${slots[0].date}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(first.getFullYear(), first.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const available = useMemo(() => new Set(slots.map((slot) => slot.date)), [slots]);
  const calendar = useMemo(() => {
    const start = new Date(month);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const value = new Date(start);
      value.setDate(start.getDate() + index);
      return value;
    });
  }, [month]);
  const times = slots.filter((slot) => slot.date === selectedDate).map((slot) => slot.time);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    const method = String(form.get("method") || "");
    const payload = {
      name: form.get("name"),
      contact: form.get("contact"),
      consent: form.get("consent"),
      service: "Запись на консультацию",
      message: `Дата: ${selectedDate}; время: ${selectedTime}; формат: ${method}`,
    };
    try {
      const response = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("request failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (!slots.length) {
    return (
      <div className="booking-empty">
        <p>{noSlotsMessage}</p>
        <div className="booking-contacts">
          <a href={`tel:${config.contacts.phone}`}>{config.contacts.phoneDisplay}</a>
          <a href={`mailto:${config.contacts.email}`}>{config.contacts.email}</a>
          <a href={config.contacts.max} target="_blank" rel="noreferrer">MAX</a>
          <a href={config.contacts.telegram} target="_blank" rel="noreferrer">Telegram</a>
        </div>
      </div>
    );
  }

  return (
    <form className="booking-form" onSubmit={submit}>
      <fieldset>
        <legend>1. Выберите свободную дату</legend>
        <div className="calendar-heading"><button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><b>{new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(month)}</b><button type="button" aria-label="Следующий месяц" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button></div>
        <div className="calendar-weekdays" aria-hidden="true">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {calendar.map((date) => {
            const key = dateKey(date);
            const inMonth = date.getMonth() === month.getMonth();
            const isAvailable = available.has(key);
            return <button key={key} type="button" className={`${inMonth ? "" : "is-outside"} ${isAvailable ? "is-available" : ""} ${selectedDate === key ? "is-selected" : ""}`} disabled={!isAvailable} aria-label={new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date)} onClick={() => { setSelectedDate(key); setSelectedTime(""); }}>{date.getDate()}</button>;
          })}
        </div>
        <p className="calendar-legend"><i /> Свободная дата</p>
      </fieldset>

      <fieldset disabled={!selectedDate}>
        <legend>2. Выберите время</legend>
        <div className="time-options">{times.map((time) => <button type="button" className={selectedTime === time ? "is-selected" : ""} key={time} onClick={() => setSelectedTime(time)}>{time}</button>)}</div>
        <p className="calendar-legend"><i /> Свободное время</p>
      </fieldset>

      <fieldset className="method-options" disabled={!selectedTime}>
        <legend>3. Формат встречи</legend>
        <label><input type="radio" name="method" value={`Очно — ${config.contacts.location}`} required /> Очно — {config.contacts.location}</label>
        <label><input type="radio" name="method" value="Онлайн — Яндекс Телемост" required /> Онлайн — Яндекс Телемост</label>
        <label><input type="radio" name="method" value="Онлайн — VK Звонки" required /> Онлайн — VK Звонки</label>
      </fieldset>

      <div className="field-grid">
        <label><span>Ваше имя</span><input name="name" autoComplete="name" required /></label>
        <label><span>Телефон, email или мессенджер</span><input name="contact" required /></label>
      </div>
      <label className="consent"><input type="checkbox" name="consent" value="yes" required /><span>Согласен(на) на обработку персональных данных согласно <Link href="/politika">политике конфиденциальности</Link></span></label>
      <button className="button button--primary" disabled={!selectedTime || status === "sending"}>{status === "sending" ? "Отправляем…" : "Записаться"}</button>
      <p className="form-note" aria-live="polite">{status === "sent" && "Запись отправлена. Я подтвержу выбранное время."}{status === "error" && "Не удалось отправить запись. Пожалуйста, свяжитесь со мной по телефону или в мессенджере."}</p>
    </form>
  );
}
