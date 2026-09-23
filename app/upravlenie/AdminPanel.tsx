"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { SiteConfig } from "../lib/site-config";
import { pricingItems, services } from "../lib/content";

type Status = "idle" | "loading" | "saving" | "saved" | "error";

export function AdminPanel() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");

  async function load() {
    const response = await fetch("/api/admin/config", { cache: "no-store" });
    if (response.status === 401) {
      setAuthorized(false);
      setStatus("idle");
      return;
    }
    const result = (await response.json()) as { config?: SiteConfig };
    if (!response.ok || !result.config) {
      setStatus("error");
      setMessage("Не удалось загрузить настройки.");
      return;
    }
    setConfig(result.config);
    setAuthorized(true);
    setStatus("idle");
  }

  useEffect(() => {
    // The first protected request establishes whether a valid session exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus("error");
      setMessage(result.error || "Не удалось войти.");
      return;
    }
    await load();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    setStatus("saving");
    setMessage("");
    const response = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    });
    const result = (await response.json().catch(() => ({}))) as { config?: SiteConfig; error?: string };
    if (!response.ok || !result.config) {
      setStatus("error");
      setMessage(result.error || "Не удалось сохранить настройки.");
      return;
    }
    setConfig(result.config);
    setStatus("saved");
    setMessage("Изменения сохранены и появятся на сайте в течение короткого времени.");
  }

  function contact<K extends keyof SiteConfig["contacts"]>(key: K, value: SiteConfig["contacts"][K]) {
    setConfig((current) => current ? { ...current, contacts: { ...current.contacts, [key]: value } } : current);
  }

  function addSlot() {
    if (!config || !slotDate || !slotTime) return;
    const next = [...config.bookingSlots, { date: slotDate, time: slotTime }]
      .filter((slot, index, all) => all.findIndex((item) => item.date === slot.date && item.time === slot.time) === index)
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    setConfig({ ...config, bookingSlots: next });
    setSlotTime("");
  }

  if (authorized === null) {
    return <main className="admin-shell"><p>Загрузка…</p></main>;
  }

  if (!authorized) {
    return (
      <main className="admin-shell admin-shell--login">
        <section className="admin-card">
          <p className="eyebrow">Закрытый раздел</p>
          <h1>Управление сайтом</h1>
          <p>Введите пароль владельца сайта.</p>
          <form className="admin-login" onSubmit={login}>
            <label><span>Пароль</span><input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
            <button className="button button--primary" disabled={status === "loading"}>Войти</button>
          </form>
          {message && <p className="admin-message admin-message--error" role="alert">{message}</p>}
          <Link className="text-link" href="/">Вернуться на сайт</Link>
        </section>
      </main>
    );
  }

  if (!config) return <main className="admin-shell"><p>Настройки недоступны.</p></main>;

  return (
    <main className="admin-shell">
      <header className="admin-heading">
        <div><p className="eyebrow">Закрытый раздел</p><h1>Управление сайтом</h1><p>Контакты, цены, стаж и свободное время для консультаций.</p></div>
        <div className="admin-heading-actions"><Link className="button button--outline" href="/" target="_blank">Открыть сайт</Link><button className="button button--quiet" type="button" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); location.reload(); }}>Выйти</button></div>
      </header>

      <form className="admin-form" onSubmit={save}>
        <section className="admin-card">
          <h2>Контакты</h2>
          <div className="admin-grid">
            <label><span>Телефон на экране</span><input value={config.contacts.phoneDisplay} onChange={(event) => contact("phoneDisplay", event.target.value)} /></label>
            <label><span>Телефон для ссылки</span><input value={config.contacts.phone} onChange={(event) => contact("phone", event.target.value)} /></label>
            <label><span>Электронная почта</span><input type="email" value={config.contacts.email} onChange={(event) => contact("email", event.target.value)} /></label>
            <label><span>Ссылка Telegram</span><input type="url" value={config.contacts.telegram} onChange={(event) => contact("telegram", event.target.value)} /></label>
            <label><span>Ссылка MAX</span><input type="url" value={config.contacts.max} onChange={(event) => contact("max", event.target.value)} /></label>
            <label><span>Место приёма</span><input value={config.contacts.location} onChange={(event) => contact("location", event.target.value)} /></label>
            <label className="admin-wide"><span>Формат работы</span><input value={config.contacts.workFormat} onChange={(event) => contact("workFormat", event.target.value)} /></label>
          </div>
        </section>

        <section className="admin-card">
          <h2>Стаж и цены</h2>
          <label className="admin-short"><span>Стаж на главной</span><input value={config.experienceYears} onChange={(event) => setConfig({ ...config, experienceYears: event.target.value })} /></label>
          <h3>Страницы услуг</h3>
          <div className="admin-price-list">
            {services.map((service) => <label key={service.slug}><span>{service.short}</span><input value={config.servicePrices[service.slug]} onChange={(event) => setConfig({ ...config, servicePrices: { ...config.servicePrices, [service.slug]: event.target.value } })} /></label>)}
          </div>
          <h3>Общая страница стоимости</h3>
          <div className="admin-price-list">
            {pricingItems.map((item) => <label key={item.id}><span>{item.title}</span><input value={config.pricingPrices[item.id]} onChange={(event) => setConfig({ ...config, pricingPrices: { ...config.pricingPrices, [item.id]: event.target.value } })} /></label>)}
          </div>
        </section>

        <section className="admin-card">
          <h2>Свободное время</h2>
          <p>Добавьте дату и время. Только эти слоты будут доступны в форме записи.</p>
          <div className="admin-slot-add">
            <label><span>Дата</span><input type="date" value={slotDate} onChange={(event) => setSlotDate(event.target.value)} /></label>
            <label><span>Время</span><input type="time" value={slotTime} onChange={(event) => setSlotTime(event.target.value)} /></label>
            <button className="button button--outline" type="button" onClick={addSlot}>Добавить</button>
          </div>
          {config.bookingSlots.length ? (
            <div className="admin-slots">
              {config.bookingSlots.map((slot) => <div key={`${slot.date}-${slot.time}`}><span>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${slot.date}T12:00:00`))} · {slot.time}</span><button type="button" onClick={() => setConfig({ ...config, bookingSlots: config.bookingSlots.filter((item) => item !== slot) })}>Удалить</button></div>)}
            </div>
          ) : <p className="admin-empty">Свободных слотов пока нет.</p>}
        </section>

        <div className="admin-savebar">
          <button className="button button--primary" disabled={status === "saving"}>{status === "saving" ? "Сохраняем…" : "Сохранить изменения"}</button>
          {message && <p className={status === "error" ? "admin-message admin-message--error" : "admin-message"} role="status">{message}</p>}
        </div>
      </form>
    </main>
  );
}
