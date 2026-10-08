"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { SiteConfig } from "../lib/site-config";
import { pricingItems, services } from "../lib/content";

type Status = "idle" | "loading" | "saving" | "saved" | "error";
type LeadStatus = "new" | "in_progress" | "done" | "declined" | "anonymized";
type LeadQualification = "unreviewed" | "target" | "non_target";
type ConsultationStatus = "unreviewed" | "held" | "not_held";
type ContractStatus = "unreviewed" | "signed" | "not_signed";
type EconomicsRow = {
  channel: string;
  leads: number;
  targetLeads: number;
  consultations: number;
  contracts: number;
  spendRub: number;
  revenueRub: number;
  cplRub: number | null;
  targetLeadCostRub: number | null;
  cacRub: number | null;
};
type WeeklyEconomics = {
  weekStart: string;
  rows: EconomicsRow[];
  total: EconomicsRow;
};
type DeliveryRecord = {
  channel: "telegram" | "max" | "email" | "webhook";
  status: "pending" | "failed" | "sent";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
};
type LeadRecord = {
  id: string;
  public_number: string;
  name: string;
  contact: string;
  service: string;
  message: string;
  status: LeadStatus;
  notes: string;
  source: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  qualification: LeadQualification;
  consultation_status: ConsultationStatus;
  contract_status: ContractStatus;
  revenue_rub: number;
  created_at: string;
  anonymized_at: string | null;
  deliveries: DeliveryRecord[];
};

const deliveryNames: Record<DeliveryRecord["channel"], string> = {
  telegram: "Telegram",
  max: "MAX",
  email: "Email",
  webhook: "Webhook",
};

const deliveryStatuses: Record<DeliveryRecord["status"], string> = {
  pending: "ожидает",
  failed: "ошибка",
  sent: "отправлено",
};

function utmLabel(lead: LeadRecord) {
  return [
    lead.utm_source ? "source=" + lead.utm_source : "",
    lead.utm_medium ? "medium=" + lead.utm_medium : "",
    lead.utm_campaign ? "campaign=" + lead.utm_campaign : "",
    lead.utm_content ? "content=" + lead.utm_content : "",
    lead.utm_term ? "term=" + lead.utm_term : "",
  ].filter(Boolean).join(" · ") || "Без UTM";
}

function formSourceLabel(source: string) {
  return source === "booking" ? "Запись на консультацию" : "Форма сайта";
}

function mondayFor(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return [year, month, day].join("-");
}

function rubles(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value) + " ₽";
}

function channelLabel(channel: string) {
  if (channel === "direct") return "Прямые заходы";
  if (channel === "referral") return "Переходы с сайтов";
  return channel;
}

export function AdminPanel() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadStatus, setLeadStatus] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [economicsWeek, setEconomicsWeek] = useState(mondayFor);
  const [economics, setEconomics] = useState<WeeklyEconomics | null>(null);
  const [costChannel, setCostChannel] = useState("");
  const [costSpend, setCostSpend] = useState("");

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
    await Promise.all([loadLeads(), loadEconomics()]);
  }

  async function loadLeads(query = leadQuery, selectedStatus = leadStatus) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (selectedStatus) params.set("status", selectedStatus);
    const response = await fetch("/api/admin/leads?" + params, { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as { leads?: LeadRecord[] };
    if (response.ok && result.leads) {
      setLeads(result.leads);
      const availableIds = new Set(result.leads.map((lead) => lead.id));
      setSelectedLeadIds((ids) => ids.filter((id) => availableIds.has(id)));
    }
  }

  async function loadEconomics(week = economicsWeek) {
    const response = await fetch("/api/admin/economics?week=" + encodeURIComponent(week), { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as { economics?: WeeklyEconomics };
    if (response.ok && result.economics) setEconomics(result.economics);
    else setMessage("Не удалось загрузить экономику за выбранную неделю.");
  }

  async function saveMarketingCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const spendRub = Number(costSpend.replace(",", "."));
    if (!costChannel.trim() || !Number.isFinite(spendRub) || spendRub < 0) {
      setMessage("Укажите канал и неотрицательную сумму расходов.");
      return;
    }
    const response = await fetch("/api/admin/economics", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekStart: economicsWeek, channel: costChannel, spendRub }),
    });
    if (!response.ok) {
      setMessage("Не удалось сохранить расходы. Проверьте неделю, канал и сумму.");
      return;
    }
    setCostChannel("");
    setCostSpend("");
    setMessage("Расходы сохранены.");
    await loadEconomics();
  }

  async function saveLead(lead: LeadRecord) {
    const response = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: lead.id,
        status: lead.status,
        notes: lead.notes,
        qualification: lead.qualification,
        consultationStatus: lead.consultation_status,
        contractStatus: lead.contract_status,
        revenueRub: Number(lead.revenue_rub),
      }),
    });
    if (!response.ok) setMessage("Не удалось сохранить заявку №" + lead.public_number + ".");
    else await loadLeads();
  }

  async function anonymize(lead: LeadRecord) {
    if (!window.confirm("Обезличить заявку №" + lead.public_number + "? Это действие необратимо.")) return;
    const response = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: lead.id, action: "anonymize" }),
    });
    if (!response.ok) setMessage("Не удалось обезличить заявку.");
    else await loadLeads();
  }

  async function deleteSelectedLeads() {
    if (!selectedLeadIds.length) return;
    const confirmed = window.confirm(
      `Удалить выбранные заявки: ${selectedLeadIds.length}? Заявки, история и статусы уведомлений будут удалены без возможности восстановления.`,
    );
    if (!confirmed) return;
    const response = await fetch("/api/admin/leads", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selectedLeadIds }),
    });
    const result = await response.json().catch(() => ({})) as { deleted?: number };
    if (!response.ok) {
      setMessage("Не удалось удалить выбранные заявки.");
      return;
    }
    setSelectedLeadIds([]);
    setMessage(`Удалено заявок: ${result.deleted ?? selectedLeadIds.length}.`);
    await loadLeads();
  }

  async function resetLeadNumbering() {
    const confirmed = window.confirm(
      "Сбросить нумерацию заявок? Это возможно только при пустом журнале. Следующая заявка получит номер 1.",
    );
    if (!confirmed) return;
    const response = await fetch("/api/admin/leads", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: [], resetCounter: true }),
    });
    const result = await response.json().catch(() => ({})) as { counterReset?: boolean; error?: string };
    if (!response.ok || !result.counterReset) {
      setMessage(result.error === "journal_not_empty"
        ? "Нумерацию можно сбросить только после удаления всех заявок."
        : "Не удалось сбросить нумерацию заявок.");
      return;
    }
    setMessage("Нумерация сброшена. Следующая заявка получит номер 1.");
  }

  useEffect(() => {
    // The first protected request establishes whether a valid session exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // Loading is intentionally performed once for the current session cookie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <nav className="admin-section-nav" aria-label="Разделы управления">
        <a href="#admin-economics">Экономика</a>
        <a href="#admin-leads">Журнал заявок</a>
        <a href="#admin-contacts">Контакты</a>
        <a href="#admin-pricing">Стаж и цены</a>
        <a href="#admin-slots">Свободное время</a>
      </nav>

      <section className="admin-card admin-economics" id="admin-economics">
        <div className="admin-card-heading">
          <div><h2>Экономика лидов</h2><p>Недельная сводка содержит только количества и суммы, без персональных данных.</p></div>
          <label className="admin-week"><span>Неделя с понедельника</span><input type="date" min="2020-01-06" step="7" value={economicsWeek} onChange={(event) => { setEconomicsWeek(event.target.value); void loadEconomics(event.target.value); }} /></label>
        </div>
        {economics ? <>
          <div className="admin-metrics" aria-label="Итоги недели">
            <div><span>Лиды</span><strong>{economics.total.leads}</strong></div>
            <div><span>Целевые</span><strong>{economics.total.targetLeads}</strong></div>
            <div><span>Консультации</span><strong>{economics.total.consultations}</strong></div>
            <div><span>Договоры</span><strong>{economics.total.contracts}</strong></div>
            <div><span>Расходы</span><strong>{rubles(economics.total.spendRub)}</strong></div>
            <div><span>Выручка</span><strong>{rubles(economics.total.revenueRub)}</strong></div>
            <div><span>CPL</span><strong>{rubles(economics.total.cplRub)}</strong></div>
            <div><span>CAC</span><strong>{rubles(economics.total.cacRub)}</strong></div>
          </div>
          {economics.rows.length ? <div className="admin-economics-table-wrap"><table className="admin-economics-table">
            <thead><tr><th>Канал</th><th>Лиды</th><th>Целевые</th><th>Консультации</th><th>Договоры</th><th>Расходы</th><th>Выручка</th><th>CPL</th><th>Цена целевого</th><th>CAC</th></tr></thead>
            <tbody>{economics.rows.map((row) => <tr key={row.channel}><th>{channelLabel(row.channel)}</th><td>{row.leads}</td><td>{row.targetLeads}</td><td>{row.consultations}</td><td>{row.contracts}</td><td>{rubles(row.spendRub)}</td><td>{rubles(row.revenueRub)}</td><td>{rubles(row.cplRub)}</td><td>{rubles(row.targetLeadCostRub)}</td><td>{rubles(row.cacRub)}</td></tr>)}</tbody>
          </table></div> : <p className="admin-empty">За эту неделю лидов и расходов пока нет.</p>}
        </> : <p className="admin-empty">Загрузка сводки…</p>}
        <form className="admin-cost-form" onSubmit={saveMarketingCost}>
          <label><span>Канал</span><input value={costChannel} onChange={(event) => setCostChannel(event.target.value)} placeholder="Например: yandex" maxLength={60} required /></label>
          <label><span>Расходы за неделю, ₽</span><input type="number" min="0" max="100000000" step="0.01" value={costSpend} onChange={(event) => setCostSpend(event.target.value)} required /></label>
          <button className="button button--outline">Сохранить расходы</button>
        </form>
        <p className="admin-help">Повторное сохранение того же канала и недели заменяет сумму. Канал должен совпадать с utm_source; без UTM используются direct или referral.</p>
      </section>

      <section className="admin-card admin-leads" id="admin-leads">
        <div className="admin-card-heading">
          <div><h2>Журнал заявок</h2><p>Персональные данные доступны только в этом защищённом разделе.</p></div>
          <button className="button button--outline" type="button" onClick={() => void loadLeads()}>Обновить</button>
        </div>
        <div className="admin-lead-filters">
          <label><span>Поиск</span><input value={leadQuery} onChange={(event) => setLeadQuery(event.target.value)} placeholder="Номер, имя, контакт или услуга" /></label>
          <label><span>Статус</span><select value={leadStatus} onChange={(event) => setLeadStatus(event.target.value)}><option value="">Все</option><option value="new">Новые</option><option value="in_progress">В работе</option><option value="done">Завершённые</option><option value="declined">Отклонённые</option></select></label>
          <button className="button button--primary" type="button" onClick={() => void loadLeads()}>Найти</button>
        </div>
        <div className="admin-lead-maintenance">
          <p>Сброс нумерации доступен только при пустом журнале.</p>
          <button className="button button--outline" type="button" onClick={() => void resetLeadNumbering()}>Сбросить нумерацию заявок</button>
        </div>
        {leads.length ? <div className="admin-lead-selection">
          <label><input className="admin-lead-checkbox" type="checkbox" checked={selectedLeadIds.length === leads.length} onChange={(event) => setSelectedLeadIds(event.target.checked ? leads.map((lead) => lead.id) : [])} /><span>Выбрать все показанные</span></label>
          <button className="button button--quiet" type="button" disabled={!selectedLeadIds.length} onClick={() => void deleteSelectedLeads()}>Удалить выбранные{selectedLeadIds.length ? ` (${selectedLeadIds.length})` : ""}</button>
        </div> : null}
        {leads.length ? <div className="admin-lead-list">
          {leads.map((lead) => <article className="admin-lead" key={lead.id}>
            <header><label className="admin-lead-title"><input className="admin-lead-checkbox" type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={(event) => setSelectedLeadIds((ids) => event.target.checked ? [...ids, lead.id] : ids.filter((id) => id !== lead.id))} aria-label={`Выбрать заявку №${lead.public_number}`} /><span><b>Заявка №{lead.public_number}</b><small>{new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lead.created_at))}</small></span></label><strong>{lead.service}</strong></header>
            {lead.deliveries?.length ? <div className="admin-deliveries" aria-label="Статусы уведомлений">{lead.deliveries.map((delivery) => <span className={`admin-delivery admin-delivery--${delivery.status}`} key={delivery.channel}>{deliveryNames[delivery.channel]}: {deliveryStatuses[delivery.status]}{delivery.status === "failed" ? `, попыток: ${delivery.attempts}` : ""}</span>)}</div> : null}
            {lead.status !== "anonymized" ? <><div className="admin-lead-details"><p><span>Имя</span>{lead.name}</p><p><span>Контакт</span>{lead.contact}</p><p className="admin-wide"><span>Сообщение</span>{lead.message}</p></div>
            <div className="admin-lead-details admin-lead-attribution" aria-label="Источник обращения">
              <p><span>Тип формы</span>{formSourceLabel(lead.source)}</p><p><span>Точка входа</span>{lead.landing_page || "Не определена"}</p>
              <p><span>Referrer</span>{lead.referrer || "Не определён"}</p><p><span>UTM-метки</span>{utmLabel(lead)}</p>
            </div>
            <div className="admin-lead-qualification">
              <label><span>Квалификация</span><select value={lead.qualification} onChange={(event) => setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, qualification: event.target.value as LeadQualification } : item))}><option value="unreviewed">Не оценён</option><option value="target">Целевой</option><option value="non_target">Нецелевой</option></select></label>
              <label><span>Консультация</span><select value={lead.consultation_status} onChange={(event) => setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, consultation_status: event.target.value as ConsultationStatus } : item))}><option value="unreviewed">Не оценено</option><option value="held">Состоялась</option><option value="not_held">Не состоялась</option></select></label>
              <label><span>Договор</span><select value={lead.contract_status} onChange={(event) => setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, contract_status: event.target.value as ContractStatus } : item))}><option value="unreviewed">Не оценено</option><option value="signed">Заключён</option><option value="not_signed">Не заключён</option></select></label>
              <label><span>Фактическая выручка, ₽</span><input type="number" min="0" max="100000000" step="0.01" value={lead.revenue_rub} onChange={(event) => setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, revenue_rub: Number(event.target.value) } : item))} /></label>
            </div>
            <div className="admin-lead-actions"><label><span>Статус обработки</span><select value={lead.status} onChange={(event) => setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, status: event.target.value as LeadStatus } : item))}><option value="new">Новая</option><option value="in_progress">В работе</option><option value="done">Завершена</option><option value="declined">Отклонена</option></select></label><label className="admin-lead-notes"><span>Заметка</span><textarea value={lead.notes} onChange={(event) => setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, notes: event.target.value } : item))} /></label><button className="button button--outline" type="button" onClick={() => void saveLead(lead)}>Сохранить</button><button className="button button--quiet" type="button" onClick={() => void anonymize(lead)}>Обезличить</button></div></> : <p className="admin-empty">Заявка обезличена.</p>}
          </article>)}
        </div> : <p className="admin-empty">Заявок по выбранным условиям нет.</p>}
      </section>

      <form className="admin-form" onSubmit={save}>
        <section className="admin-card" id="admin-contacts">
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

        <section className="admin-card" id="admin-pricing">
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

        <section className="admin-card" id="admin-slots">
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
