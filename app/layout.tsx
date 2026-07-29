import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://bychikhina-legal.example",
  ),
  title: {
    default: "Юрист Евгения Бычихина — гражданские дела в Москве и онлайн",
    template: "%s — Евгения Бычихина",
  },
  description:
    "Судебные, семейные и наследственные споры, недвижимость, регистрация и ликвидация ООО и НКО. Юридическая помощь в Москве и онлайн по России.",
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
  },
  alternates: { canonical: "/" },
  other: {
    "codex-preview": "development",
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
      <body>{children}</body>
    </html>
  );
}
