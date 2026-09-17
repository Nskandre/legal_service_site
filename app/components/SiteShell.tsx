"use client";

import { useEffect, useState } from "react";
import { contacts, nav, services } from "../lib/content";
import { LeadForm } from "./LeadForm";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const open = () => setDialogOpen(true);
    window.addEventListener("open-lead-dialog", open);
    return () => window.removeEventListener("open-lead-dialog", open);
  }, []);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#content">К содержанию</a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Евгения Бычихина — главная">
          Евгения Бычихина
        </a>
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
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          <button className="button button--small button--primary" onClick={() => setDialogOpen(true)}>
            Разобрать мою ситуацию
          </button>
        </nav>
        <div className="header-contacts" aria-label="Контакты">
          <a href={`tel:${contacts.phone}`}>{contacts.phoneDisplay}</a>
          <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
          <a href={contacts.telegram} target="_blank" rel="noreferrer">Telegram</a>
          <a href={contacts.max} target="_blank" rel="noreferrer">MAX</a>
        </div>
      </header>

      <main id="content">{children}</main>

      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <a className="brand brand--footer" href="/">Евгения Бычихина</a>
            <p>Гражданско-правовая практика: {contacts.workFormat}.</p>
          </div>
          <div>
            <b>Услуги</b>
            {services.map((service) => (
              <a key={service.slug} href={`/uslugi/${service.slug}`}>{service.short}</a>
            ))}
          </div>
          <div>
            <b>Связаться</b>
            <a href={`tel:${contacts.phone}`}>{contacts.phoneDisplay}</a>
            <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            <a href={contacts.telegram} target="_blank" rel="noreferrer">Telegram</a>
            <a href={contacts.max} target="_blank" rel="noreferrer">MAX</a>
            <span>{contacts.location}</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Евгения Бычихина</span>
          <div>
            <a href="/politika">Конфиденциальность</a>
            <a href="/soglasie">Согласие на обработку данных</a>
          </div>
          <span>Информация на сайте не является гарантией результата.</span>
        </div>
      </footer>

      <div className="messengers" aria-label="Быстрая связь">
        <a className="messenger messenger--telegram" href={contacts.telegram} target="_blank" rel="noreferrer" aria-label="Написать в Telegram">T</a>
        <a className="messenger messenger--max" href={contacts.max} target="_blank" rel="noreferrer" aria-label="Написать в MAX">M</a>
        <a className="messenger messenger--phone" href={`tel:${contacts.phone}`} aria-label="Позвонить">☎</a>
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
            <LeadForm />
          </section>
        </div>
      )}
    </div>
  );
}
