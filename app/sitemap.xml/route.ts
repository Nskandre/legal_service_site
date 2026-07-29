import { services, siteUrl } from "../lib/content";

export function GET() {
  const paths = [
    "",
    "/ob-avtore",
    "/stoimost",
    "/kontakty",
    "/politika",
    "/soglasie",
    ...services.map((service) => `/uslugi/${service.slug}`),
  ];
  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (path) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${path ? "monthly" : "weekly"}</changefreq>
    <priority>${path ? "0.8" : "1.0"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
