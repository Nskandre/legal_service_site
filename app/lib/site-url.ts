const productionSiteUrl = "https://legservice.ru";

function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return productionSiteUrl;

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute URL");
  }

  const normalized = parsed.origin;
  const unsafeHost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname.endsWith(".example") ||
    parsed.hostname.includes("preview") ||
    parsed.hostname.includes("development");

  if (parsed.protocol !== "https:" || unsafeHost || normalized !== configured.replace(/\/+$/, "")) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a clean HTTPS production origin");
  }

  return normalized;
}

export const siteUrl = resolveSiteUrl();
