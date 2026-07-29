import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpenLeadButton, OrderButton } from "../components/Actions";
import { LeadForm } from "../components/LeadForm";
import { SiteShell } from "../components/SiteShell";
import { contacts, services, siteUrl } from "../lib/content";

type Props = { params: Promise<{ slug: string[] }> };

function pathFrom(slug: string[]) {
  return `/${slug.join("/")}`;
}

function getService(slug: string[]) {
  if (slug[0] !== "uslugi" || slug.length !== 2) return undefined;
  return services.find((service) => service.slug === slug[1]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const path = pathFrom(slug);
  const service = getService(slug);
  if (service) {
    return {
      title: service.title,
      description: service.lead,
      alternates: { canonical: path },
      openGraph: { title: service.title, description: service.lead, url: path },
    };
  }
  const entries: Record<string, { title: string; description: string }> = {
    "/ob-avtore": {
      title: "О юристе",
      description:
        "Евгения Бычихина — юрист гражданско-правовой специализации с опытом частной практики, адвокатской коллегии и судебной системы.",
    },
    "/stoimost": {
      title: "Стоимость юридических услуг",
      description:
        "Ориентиры стоимости консультаций, документов, сопровождения сделок и судебных дел.",
    },
    "/kontakty": {
      title: "Контакты",
      description:
        "Связаться с юристом Евгенией Бычихиной в Москве или получить консультацию онлайн.",
    },
    "/politika": {
      title: "Политика конфиденциальности",
      description: "Правила обработки персональных данных посетителей сайта.",
    },
    "/soglasie": {
      title: "Согласие на обработку персональных данных",
      description: "Условия согласия посетителя сайта на обработку персональных данных.",
    },
  };
  const entry = entries[path];
  return entry
    ? { title: entry.title, description: entry.description, alternates: { canonical: path } }
    : {};
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const path = pathFrom(slug);
  const service = getService(slug);
  if (service) return <ServicePage service={service} />;
  if (path === "/ob-avtore") return <AboutPage />;
  if (path === "/stoimost") return <PricingPage />;
  if (path === "/kontakty") return <ContactsPage />;
  if (path === "/politika") return <PolicyPage consent={false} />;
  if (path === "/soglasie") return <PolicyPage consent />;
  notFound();
}

function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      <a href="/">Главная</a><span>→</span><span>{current}</span>
    </nav>
  );
}

function ServicePage({ service }: { service: (typeof services)[number] }) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: service.title,
        description: service.lead,
        provider: { "@id": `${siteUrl}/#legal-service` },
        areaServed: "Россия",
        offers: { "@type": "Offer", priceCurrency: "RUB", description: service.price },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Главная", item: siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: service.short,
            item: `${siteUrl}/uslugi/${service.slug}`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: service.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="inner-hero">
        <Breadcrumbs current={service.short} />
        <div className="inner-hero-grid">
          <div>
            <p className="eyebrow">{service.eyebrow}</p>
            <h1>{service.title}</h1>
            <p className="inner-lead">{service.lead}</p>
            <div className="hero-actions">
              <OpenLeadButton />
              <a className="button button--outline" href="#details">Что входит</a>
            </div>
          </div>
          <aside className="service-summary">
            <span>Стоимость</span><b>{service.price}</b>
            <span>Срок ответа</span><b>{service.timeline}</b>
            <small>Точная стоимость определяется после изучения задачи.</small>
          </aside>
        </div>
      </section>

      <section className="section detail-grid" id="details">
        <div>
          <p className="eyebrow">Когда стоит обратиться</p>
          <h2>Ситуации, с которыми я работаю</h2>
          <ul className="check-list">
            {service.audience.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="paper-card">
          <p className="eyebrow">В услугу входит</p>
          <ul className="included-list">
            {service.includes.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="section service-result">
        <p className="eyebrow">Результат работы</p>
        <blockquote>{service.result}</blockquote>
      </section>

      <section className="section process">
        <div className="section-heading">
          <div><p className="eyebrow">Порядок работы</p><h2>От вопроса к юридически устойчивому решению</h2></div>
        </div>
        <div className="process-grid">
          {service.steps.map((step, index) => (
            <article key={step.title}>
              <span>0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section faq">
        <div><p className="eyebrow">Коротко о главном</p><h2>Частые вопросы</h2></div>
        <div className="faq-list">
          {service.faq.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary><p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section consultation">
        <div><p className="eyebrow">Следующий шаг</p><h2>Получите первичную оценку ситуации</h2><p>Оставьте контакты и коротко опишите задачу. Ответ — в ближайшее рабочее время.</p></div>
        <LeadForm service={service.title} />
      </section>
    </SiteShell>
  );
}

function AboutPage() {
  return (
    <SiteShell>
      <section className="inner-hero inner-hero--short">
        <Breadcrumbs current="Обо мне" />
        <p className="eyebrow">Евгения Геннадьевна Бычихина</p>
        <h1>Юрист, который понимает судебный процесс изнутри</h1>
        <p className="inner-lead">
          Моя специализация — гражданское право: семейные и наследственные споры,
          недвижимость, сделки, взыскание задолженности и корпоративные процедуры.
        </p>
      </section>
      <section className="section biography">
        <div className="paper-card">
          <p className="eyebrow">Образование</p>
          <h3>РАНХиГС, юридический факультет</h3>
          <p>Гражданско-правовая специализация, квалификация «юрист», 2014 год.</p>
        </div>
        <div>
          <p className="eyebrow">Профессиональный путь</p>
          <h2>Частная практика, адвокатская коллегия и судебная система</h2>
          <p>
            Профессиональный опыт включает частную юридическую практику, работу
            помощником адвоката, секретарем судебного заседания, заведующей
            канцелярией и заместителем начальника общего отдела районного суда.
          </p>
          <p>
            Этот путь сформировал практический взгляд на доказательства,
            процессуальные сроки, организацию судебного дела и исполнение решений.
          </p>
        </div>
      </section>
      <section className="section values-grid">
        {[
          ["Ясность", "Объясняю правовую ситуацию обычным языком и фиксирую следующие шаги."],
          ["Обоснованность", "Не обещаю результат без анализа документов и судебных рисков."],
          ["Организованность", "Контролирую сроки, документы и движение дела по этапам."],
          ["Деликатность", "Бережно работаю с конфиденциальными и эмоционально сложными вопросами."],
        ].map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
      </section>
      <section className="section consultation">
        <div><p className="eyebrow">Знакомство</p><h2>Обсудим вашу задачу</h2><p>Начнем с короткого описания ситуации и списка имеющихся документов.</p></div>
        <LeadForm compact />
      </section>
    </SiteShell>
  );
}

function PricingPage() {
  const items = [
    ["Первичная консультация", "Разбор ситуации, документов и возможных действий", "от 5 000 ₽"],
    ["Правовой анализ и стратегия", "Письменная оценка перспектив, рисков и доказательств", "от 15 000 ₽"],
    ["Подготовка документа", "Претензия, иск, отзыв, договор или соглашение", "от 8 000 ₽"],
    ["Сопровождение сделки", "Проверка, договор, переговоры и регистрационные действия", "от 20 000 ₽"],
    ["Ведение судебного дела", "Стратегия, документы и участие в заседаниях", "по смете"],
  ];
  return (
    <SiteShell>
      <section className="inner-hero inner-hero--short">
        <Breadcrumbs current="Стоимость" />
        <p className="eyebrow">Прозрачный бюджет</p>
        <h1>Стоимость юридических услуг</h1>
        <p className="inner-lead">
          До начала работы вы получаете описание объема, этапов и стоимости.
          Цены ниже — ориентиры; точная сумма зависит от документов и сложности.
        </p>
      </section>
      <section className="section pricing-list">
        {items.map(([title, text, price]) => (
          <article key={title}>
            <div><h3>{title}</h3><p>{text}</p></div>
            <b>{price}</b>
            <OrderButton service={title} />
          </article>
        ))}
      </section>
      <section className="section pricing-note">
        <div><h2>Можно оплачивать работу по этапам</h2><p>Для объемных дел стоимость делится на согласованные этапы: анализ, подготовка позиции, подача документов, заседания и исполнение.</p></div>
        <a className="button button--outline" href="/kontakty">Задать вопрос о стоимости</a>
      </section>
    </SiteShell>
  );
}

function ContactsPage() {
  return (
    <SiteShell>
      <section className="inner-hero inner-hero--short">
        <Breadcrumbs current="Контакты" />
        <p className="eyebrow">Связаться</p>
        <h1>Удобным для вас способом</h1>
        <p className="inner-lead">Москва, м. Академическая. Консультации также проводятся онлайн по России.</p>
      </section>
      <section className="section contacts-grid">
        <div className="contact-cards">
          <a href={`tel:${contacts.phone}`}><span>Телефон</span><b>{contacts.phoneDisplay}</b></a>
          <a href={`mailto:${contacts.email}`}><span>Электронная почта</span><b>{contacts.email}</b></a>
          <a href={contacts.telegram} target="_blank" rel="noreferrer"><span>Мессенджер</span><b>Написать в Telegram ↗</b></a>
          <div><span>Формат работы</span><b>Москва · онлайн по России</b></div>
        </div>
        <div className="paper-card">
          <p className="eyebrow">Заявка</p>
          <h2>Опишите ваш вопрос</h2>
          <LeadForm />
        </div>
      </section>
    </SiteShell>
  );
}

function PolicyPage({ consent }: { consent: boolean }) {
  const title = consent
    ? "Согласие на обработку персональных данных"
    : "Политика конфиденциальности";
  return (
    <SiteShell>
      <article className="legal-page">
        <Breadcrumbs current={title} />
        <p className="eyebrow">Правовая информация</p>
        <h1>{title}</h1>
        {consent ? (
          <>
            <p>Направляя форму на сайте, пользователь свободно, своей волей и в своем интересе дает согласие Евгении Геннадьевне Бычихиной на обработку указанных им персональных данных.</p>
            <h2>1. Состав данных</h2>
            <p>Имя, телефон, адрес электронной почты или имя пользователя в мессенджере, а также сведения, добровольно указанные в описании обращения.</p>
            <h2>2. Цель обработки</h2>
            <p>Обработка обращения, обратная связь, согласование консультации и подготовка предложения о юридической помощи.</p>
            <h2>3. Действия с данными</h2>
            <p>Сбор, запись, систематизация, хранение, использование, передача используемым сервисам связи и уничтожение в объеме, необходимом для цели обработки.</p>
            <h2>4. Срок и отзыв</h2>
            <p>Согласие действует до достижения цели либо его отзыва. Отозвать согласие можно письмом на <a href={`mailto:${contacts.email}`}>{contacts.email}</a>.</p>
          </>
        ) : (
          <>
            <p>Настоящая политика описывает обработку персональных данных посетителей сайта юридической практики Евгении Геннадьевны Бычихиной.</p>
            <h2>1. Какие данные обрабатываются</h2>
            <p>Данные, которые пользователь самостоятельно указывает в форме: имя, контакт для связи и описание ситуации. Технически могут обрабатываться IP-адрес, сведения о браузере и файлы cookie, необходимые для работы сайта.</p>
            <h2>2. Цели и основания</h2>
            <p>Данные используются для ответа на обращение, согласования услуг, обеспечения работы и безопасности сайта. Данные из формы обрабатываются на основании согласия пользователя.</p>
            <h2>3. Передача и хранение</h2>
            <p>Для доставки заявок могут использоваться сервисы электронной почты, Telegram и SMS. Передаются только данные, необходимые для доставки сообщения. До подключения сервисов владелец сайта обязан оценить их условия и требования к локализации данных.</p>
            <h2>4. Права пользователя</h2>
            <p>Пользователь может запросить сведения об обработке, уточнение, блокирование или удаление данных, а также отозвать согласие по адресу <a href={`mailto:${contacts.email}`}>{contacts.email}</a>.</p>
            <h2>5. Безопасность</h2>
            <p>Применяются организационные и технические меры, соответствующие характеру обрабатываемых данных и используемой инфраструктуре.</p>
          </>
        )}
        <p className="legal-date">Редакция от 29 июля 2026 года. Перед публичным запуском документ рекомендуется проверить с учетом фактических сервисов, реквизитов оператора и места размещения данных.</p>
      </article>
    </SiteShell>
  );
}
