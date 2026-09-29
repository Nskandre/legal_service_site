const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://legservice.ru";

let url;
try {
  url = new URL(configured);
} catch {
  console.error("NEXT_PUBLIC_SITE_URL must be an absolute URL.");
  process.exit(1);
}

const unsafeHost =
  url.hostname === "localhost" ||
  url.hostname === "127.0.0.1" ||
  url.hostname.endsWith(".example") ||
  url.hostname.includes("preview") ||
  url.hostname.includes("development");

if (url.protocol !== "https:" || unsafeHost || url.origin !== configured.replace(/\/+$/, "")) {
  console.error("Production build blocked: NEXT_PUBLIC_SITE_URL must be a clean HTTPS production origin.");
  process.exit(1);
}

console.log("Production origin validated:", url.origin);
