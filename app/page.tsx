import { LeadForm } from "./components/LeadForm";
import Link from "next/link";
import { OpenBookingButton, OpenLeadButton } from "./components/Actions";
import { SiteShell } from "./components/SiteShell";
import { services, siteUrl } from "./lib/content";
import { configuredServices, getSiteConfig, type SiteConfig } from "./lib/site-config";

export const dynamic = "force-dynamic";

function createLegalServiceSchema(pageContacts: SiteConfig["contacts"], pageServices: typeof services) {
  return {
  "@context": "https://schema.org",
  "@type": "LegalService",
  "@id": `${siteUrl}/#legal-service`,
  name: "Юридическая практика Евгении Бычихиной",
  url: siteUrl,
  telephone: pageContacts.phone,
  email: pageContacts.email,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Москва",
    addressCountry: "RU",
  },
  areaServed: [
    { "@type": "City", name: "Москва" },
    { "@type": "Country", name: "Россия" },
  ],
  priceRange: "₽₽",
  founder: {
    "@type": "Person",
    name: "Евгения Геннадьевна Бычихина",
    jobTitle: "Юрист",
    alumniOf: "Российская академия народного хозяйства и государственной службы",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Юридические услуги",
    itemListElement: pageServices.map((service) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: service.title,
        url: `${siteUrl}/uslugi/${service.slug}`,
      },
    })),
  },
  };
}

export default async function Home() {
  const config = await getSiteConfig();
  const pageContacts = config.contacts;
  const pageServices = configuredServices(config);
  const legalServiceSchema = createLegalServiceSchema(pageContacts, pageServices);
  return (
    <SiteShell config={config}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(legalServiceSchema) }}
      />

      <section className="hero">
        <div className="hero-copy reveal">
          <p className="eyebrow">Юрист по гражданским делам · {pageContacts.workFormat}</p>
          <h1>Юридическая стратегия для сложных жизненных и имущественных вопросов</h1>
          <p className="hero-lead">
            Гражданско-правовая практика и глубокое знание судебной системы —
            для решений, которые защищают ваши интересы.
          </p>
          <div className="hero-actions">
            <OpenLeadButton />
            <OpenBookingButton className="button--outline" />
            <a className="button button--outline" href="#services">Услуги и стоимость</a>
          </div>
        </div>
        <div className="hero-art">
          {/* A plain local image plus CSS background fallback is intentional for Android/Yandex compatibility. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-paper.png"
            alt="Композиция из фактурной бумаги и сургучной печати"
            width="1122"
            height="1402"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="trust-strip">
          <div><span className="trust-icon">§</span><b>Гражданско-правовая<br />специализация</b></div>
          <div><span className="trust-icon">◇</span><b>Опыт внутри<br />судебной системы</b></div>
          <div><span className="trust-icon">⌖</span><b>{pageContacts.workFormat}</b></div>
        </div>
      </section>

      <section className="section section--services" id="services">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Четыре направления практики</p>
            <h2>Помощь там, где цена ошибки особенно высока</h2>
          </div>
          <p>
            Каждое дело начинается с оценки документов, цели и рисков.
            Вы заранее понимаете этапы, стоимость и возможные сценарии.
          </p>
        </div>
        <div className="service-grid">
          {pageServices.map((service, index) => (
            <a className="service-card" href={`/uslugi/${service.slug}`} key={service.slug}>
              <span className="service-number">0{index + 1}</span>
              <h3>{service.short}</h3>
              <p>{service.lead}</p>
              <span className="text-link">Подробнее об услуге <i>↗</i></span>
            </a>
          ))}
        </div>
      </section>

      <section className="section expertise" id="practice">
        <div className="expertise-statement">
          <p className="eyebrow">Практика изнутри</p>
          <h2>Понимание не только нормы закона, но и того, как движется дело</h2>
          <p>
            Опыт работы в районном суде, системе мировых судей, коллегии
            адвокатов и частной практике помогает видеть процесс целиком:
            от качества доказательств до контроля исполнения судебного акта.
          </p>
          <Link className="text-link" href="/ob-avtore">Подробнее об опыте <i>↗</i></Link>
        </div>
        <div className="experience-list">
          <div><b>{config.experienceYears}</b><span>в юридической сфере</span></div>
          <div><b>Гражданское право</b><span>профильное высшее образование</span></div>
          <div><b>Судебная система</b><span>опыт организации судебной работы и контроля исполнения</span></div>
        </div>
      </section>

      <section className="section process">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Как строится работа</p>
            <h2>Спокойно, последовательно и без скрытых этапов</h2>
          </div>
        </div>
        <div className="process-grid">
          {[
            ["01", "Знакомство", "Вы описываете задачу и присылаете ключевые документы."],
            ["02", "Правовая оценка", "Я определяю варианты, ограничения, сроки и риски."],
            ["03", "План и стоимость", "Фиксируем объем работы, этапы и бюджет."],
            ["04", "Реализация", "Готовлю документы, веду переговоры или судебный процесс."],
          ].map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section consultation">
        <div>
          <p className="eyebrow">Первичный разбор</p>
          <h2>Начнем с вашей ситуации</h2>
          <p>
            Опишите вопрос в нескольких предложениях. Я сообщу, какие документы
            нужны и какой формат помощи подойдет.
          </p>
        </div>
        <LeadForm contactDetails={pageContacts} />
      </section>
    </SiteShell>
  );
}
