import type { Metadata } from "next";
import "./globals.css";
import { Metrika } from "./components/Metrika";
import { siteUrl } from "./lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Юрист по гражданским делам в Москве — Евгения Бычихина",
    template: "%s — Евгения Бычихина",
  },
  description:
    "Судебные, семейные и наследственные споры, недвижимость. Юридическая помощь: Москва, метро Академическая * онлайн по России.",
  keywords: [
    "юрист Москва",
    "гражданский юрист",
    "семейный юрист",
    "наследственный юрист",
    "юрист по недвижимости",
    "судебное представительство",
  ],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Юридическая практика Евгении Бычихиной",
    title: "Юрист Евгения Бычихина",
    description:
      "Юридическая стратегия для сложных жизненных и имущественных вопросов.",
    url: "/",
    images: [
      {
        url: "/og-legal-service.webp",
        width: 1200,
        height: 630,
        alt: "Юридическая практика Евгении Бычихиной",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Юрист по гражданским делам в Москве — Евгения Бычихина",
    description: "Юридическая стратегия для сложных жизненных и имущественных вопросов.",
    images: ["/og-legal-service.webp"],
  },
  alternates: { canonical: "/" },
  other: {
    "geo.region": "RU-MOW",
    "geo.placename": "Москва",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Metrika counterId={process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID} />
      </body>
    </html>
  );
}
