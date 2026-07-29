import { LeadForm } from "./components/LeadForm";
import { OpenLeadButton } from "./components/Actions";
import { SiteShell } from "./components/SiteShell";
import { contacts, services, siteUrl } from "./lib/content";

const legalServiceSchema = {
  "@context": "https://schema.org",
  "@type": "LegalService",
  "@id": `${siteUrl}/#legal-service`,
  name: "Юридическая практика Евгении Бычихиной",
  url: siteUrl,
  telephone: contacts.phone,
  email: contacts.email,
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
    itemListElement: services.map((service) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: service.title,
        url: `${siteUrl}/uslugi/${service.slug}`,
      },
    })),
  },
};

export default function Home() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(legalServiceSchema) }}
      />

      <section className="hero">
        <div className="hero-copy reveal">
          <p className="eyebrow">Юрист по гражданским делам · Москва и онлайн</p>
          <h1>Юридическая стратегия для сложных жизненных и имущественных вопросов</h1>
          <p className="hero-lead">
            Гражданско-правовая практика и глубокое знание судебной системы —
            для решений, которые защищают ваши интересы.
          </p>
          <div className="hero-actions">
            <OpenLeadButton />
            <a className="button button--outline" href="#services">Услуги и стоимость</a>
          </div>
        </div>
        <div className="hero-art reveal reveal--delay">
          <img
            src="/hero-paper.png"
            alt="Композиция из фактурной бумаги и сургучной печати"
            width="1122"
            height="1402"
            fetchPriority="high"
          />
        </div>
        <div className="trust-strip">
          <div><span className="trust-icon">§</span><b>Гражданско-правовая<br />специализация</b></div>
          <div><span className="trust-icon">◇</span><b>Опыт внутри<br />судебной системы</b></div>
          <div><span className="trust-icon">⌖</span><b>Москва · онлайн<br />по России</b></div>
        </div>
      </section>

      <section className="section section--services" id="services">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Пять направлений практики</p>
            <h2>Помощь там, где цена ошибки особенно высока</h2>
          </div>
          <p>
            Каждое дело начинается с оценки документов, цели и рисков.
            Вы заранее понимаете этапы, стоимость и возможные сценарии.
          </p>
        </div>
        <div className="service-grid">
          {services.map((service, index) => (
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
          <a className="text-link" href="/ob-avtore">Подробнее об опыте <i>↗</i></a>
        </div>
        <div className="experience-list">
          <div><b>10+ лет</b><span>в юридической сфере</span></div>
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
        <LeadForm />
      </section>
    </SiteShell>
  );
}
