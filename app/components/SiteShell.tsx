"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { nav, services } from "../lib/content";
import type { SiteConfig } from "../lib/site-config";
import { BookingForm } from "./BookingForm";
import { LeadForm } from "./LeadForm";

export function SiteShell({ children, config }: { children: React.ReactNode; config: SiteConfig }) {
  const { contacts } = config;
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogService, setDialogService] = useState("Первичная консультация");
  const [dialogSubmitLabel, setDialogSubmitLabel] = useState("Получить разбор ситуации");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [headerContact, setHeaderContact] = useState<"phone" | "email" | null>(null);

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ service?: string; submitLabel?: string }>).detail;
      setDialogService(detail?.service || "Первичная консультация");
      setDialogSubmitLabel(detail?.submitLabel || "Получить разбор ситуации");
      setDialogOpen(true);
    };
    const openBooking = () => setBookingOpen(true);
    window.addEventListener("open-lead-dialog", open);
    window.addEventListener("open-booking-dialog", openBooking);
    return () => {
      window.removeEventListener("open-lead-dialog", open);
      window.removeEventListener("open-booking-dialog", openBooking);
    };
  }, []);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#content">К содержанию</a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Евгения Бычихина — главная">
          Евгения Бычихина
        </Link>
        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
          <span />
          <b className="sr-only">Меню</b>
        </button>
        <nav id="site-navigation" className={menuOpen ? "site-nav is-open" : "site-nav"}>
          {nav.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <button
            className="button button--small button--primary"
            onClick={() => {
              setDialogService("Первичная консультация");
              setDialogSubmitLabel("Получить разбор ситуации");
              setDialogOpen(true);
            }}
          >
            Разобрать мою ситуацию
          </button>
        </nav>
        <div className="header-contacts" aria-label="Контакты">
          <button type="button" aria-expanded={headerContact === "phone"} onClick={() => setHeaderContact(headerContact === "phone" ? null : "phone")}>{contacts.phoneDisplay}</button>
          <button type="button" aria-expanded={headerContact === "email"} onClick={() => setHeaderContact(headerContact === "email" ? null : "email")}>{contacts.email}</button>
          <a href={contacts.max} target="_blank" rel="noreferrer">MAX</a>
          <a href={contacts.telegram} target="_blank" rel="noreferrer">Telegram</a>
        </div>
        {headerContact && (
          <div className="header-contact-popover" role="status">
            <span>{headerContact === "phone" ? "Телефон" : "Электронная почта"}</span>
            <b>{headerContact === "phone" ? contacts.phoneDisplay : contacts.email}</b>
          </div>
        )}
      </header>

      <main id="content">{children}</main>

      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <Link className="brand brand--footer" href="/">Евгения Бычихина</Link>
            <p>Гражданско-правовая практика: {contacts.workFormat}.</p>
          </div>
          <div>
            <b>Услуги</b>
            {services.map((service) => (
              <Link key={service.slug} href={`/uslugi/${service.slug}`}>{service.short}</Link>
            ))}
          </div>
          <div>
            <b>Связаться</b>
            <a href={`tel:${contacts.phone}`}>{contacts.phoneDisplay}</a>
            <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            <a href={contacts.max} target="_blank" rel="noreferrer">MAX</a>
            <a href={contacts.telegram} target="_blank" rel="noreferrer">Telegram</a>
            <span>{contacts.location}</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Евгения Бычихина</span>
          <div>
            <Link href="/politika">Конфиденциальность</Link>
            <Link href="/soglasie">Согласие на обработку данных</Link>
          </div>
          <span>
            Информация на страницах сайта не является индивидуальной юридической
            консультацией и не содержит гарантии результата по делу.
          </span>
        </div>
      </footer>

      <div className="messengers" aria-label="Быстрая связь">
        {phoneOpen && (
          <div className="phone-popover" role="status">
            <span>Телефон</span>
            <a href={`tel:${contacts.phone}`}>{contacts.phoneDisplay}</a>
          </div>
        )}
        <button
          className="messenger messenger--phone"
          type="button"
          aria-label="Показать номер телефона"
          aria-expanded={phoneOpen}
          onClick={() => setPhoneOpen(!phoneOpen)}
        >
          ☎
        </button>
        <a className="messenger messenger--max" href={contacts.max} target="_blank" rel="noreferrer" aria-label="Написать в MAX">M</a>
        <a className="messenger messenger--telegram" href={contacts.telegram} target="_blank" rel="noreferrer" aria-label="Написать в Telegram">T</a>
      </div>

      {dialogOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setDialogOpen(false)}>
          <section
            className="lead-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="dialog-close" onClick={() => setDialogOpen(false)} aria-label="Закрыть">×</button>
            <p className="eyebrow">Первичный разбор</p>
            <h2 id="lead-title">Расскажите, что произошло</h2>
            <p>Я уточню задачу, назову возможный формат работы и стоимость следующего шага.</p>
            <LeadForm service={dialogService} submitLabel={dialogSubmitLabel} contactDetails={contacts} />
          </section>
        </div>
      )}
      {bookingOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setBookingOpen(false)}>
          <section className="lead-dialog booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" onClick={() => setBookingOpen(false)} aria-label="Закрыть">×</button>
            <p className="eyebrow">Запись на консультацию</p>
            <h2 id="booking-title">Выберите удобное время</h2>
            <BookingForm config={config} />
          </section>
        </div>
      )}
    </div>
  );
}
