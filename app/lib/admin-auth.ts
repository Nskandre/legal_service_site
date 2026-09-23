import { workerBindings } from "./site-config";

const COOKIE_NAME = "legal_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function bytesToBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function signature(expires: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expires))));
}

export function adminConfigured() {
  const bindings = workerBindings();
  return Boolean(bindings.ADMIN_PASSWORD && bindings.ADMIN_SESSION_SECRET && bindings.SITE_CONFIG);
}

export async function passwordMatches(candidate: string) {
  const expected = workerBindings().ADMIN_PASSWORD;
  if (!expected) return false;
  return constantTimeEqual(await digest(candidate), await digest(expected));
}

export async function createSessionCookie() {
  const secret = workerBindings().ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const token = `${expires}.${await signature(expires, secret)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return "";
}

export async function isAdmin(request: Request) {
  const secret = workerBindings().ADMIN_SESSION_SECRET;
  const [expires, supplied] = cookieValue(request).split(".");
  if (!secret || !expires || !supplied || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = await signature(expires, secret);
  return constantTimeEqual(new TextEncoder().encode(supplied), new TextEncoder().encode(expected));
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
