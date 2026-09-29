import type { NextConfig } from "next";

const publicPageSources = [
  "/",
  "/ob-avtore",
  "/stoimost",
  "/kontakty",
  "/praktika",
  "/politika",
  "/soglasie",
  "/uslugi/:slug",
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; img-src 'self' data: https://mc.yandex.ru https://mc.yandex.md; script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://mc.yandex.ru https://mc.yandex.md; child-src blob: https://mc.yandex.ru https://mc.yandex.md; frame-src blob: https://mc.yandex.ru https://mc.yandex.md; font-src 'self' data:",
          },
        ],
      },
      ...publicPageSources.map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
          },
        ],
      })),
      {
        source: "/upravlenie",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
