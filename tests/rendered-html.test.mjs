import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test, { after, before } from "node:test";

let app;
let baseUrl;

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

before(async () => {
  const port = await availablePort();
  baseUrl = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://legservice.ru" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (app.exitCode !== null) throw new Error(`Next.js exited before tests with code ${app.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Next.js did not become ready for rendered tests", { cause: lastError });
});

after(() => {
  if (app && app.exitCode === null) app.kill();
});

async function fetchApp(path = "/", init = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

async function render(path = "/") {
  return fetchApp(path, { headers: { accept: "text/html" } });
}

test("renders production SEO metadata without preview markers", async () => {
  const response = await render();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.doesNotMatch(html, /codex-preview|bychikhina-legal\.example/i);
  assert.match(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/legservice\.ru\/?["']/i);
  assert.match(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/legservice\.ru\/?["']/i);
  assert.match(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']https:\/\/legservice\.ru\/og-legal-service\.webp["']/i);
  assert.match(html, /<meta[^>]+name=["']twitter:card["'][^>]+content=["']summary_large_image["']/i);
  assert.match(html, /srcset=["'][^"']*hero-paper-640\.webp 640w[^"']*hero-paper-1122\.webp 1122w/i);
});

test("renders consistent services, work format and communication channels", async () => {
  const homeResponse = await render();
  const home = await homeResponse.text();

  assert.equal(homeResponse.status, 200);
  assert.match(home, /Евгения Бычихина/);
  assert.match(home, /Четыре направления практики/);
  assert.match(home, /Москва, метро Академическая \* онлайн по России/);
  assert.match(home, />Telegram</);
  assert.match(home, />MAX</);
  assert.match(home, /Записаться на консультацию/);
  assert.match(home, /15\+ лет/);
  assert.match(home, /опыт судебных процессов в районных и мировых судах города Москвы/);
  assert.match(home, /name=["']contact["']/);
  assert.match(home, /name=["']consent["']/);
  assert.match(
    home,
    /Информация на страницах сайта не является индивидуальной юридической консультацией и не содержит гарантии результата по делу\./,
  );
  assert.match(home, /https:\/\/t\.me\/\+79398456395/);
  assert.match(home, /https:\/\/max\.ru\/u\/f9LHodD0cOKbM7gLACi6hYkE4Ek_ToWMXdD2zBHwJ1i_t9Av_nHZjSa2hZ8/);
  assert.doesNotMatch(home, /ООО|НКО|ooo-nko/);

  const contactsResponse = await render("/kontakty");
  const contacts = await contactsResponse.text();

  assert.equal(contactsResponse.status, 200);
  assert.match(contacts, /\+7 \(939\) 845-63-95/);
  assert.match(contacts, /legserv24@yandex\.ru/);
  assert.match(contacts, /Написать в Telegram/);
  assert.match(contacts, /Написать в MAX/);
  assert.match(contacts, /Москва, метро Академическая \* онлайн по России/);
  assert.ok(
    contacts.indexOf("Написать в MAX") < contacts.indexOf("Написать в Telegram"),
  );

  const removedService = await render("/uslugi/ooo-nko");
  assert.equal(removedService.status, 404);
});

test("renders revised about, pricing and service wording", async () => {
  const about = await (await render("/ob-avtore")).text();
  assert.match(about, /работу в судебной системе \(районный суд, мировой суд\) и адвокатуре/);
  assert.match(about, /Коротко о ситуации/);

  const pricing = await (await render("/stoimost")).text();
  assert.match(pricing, /Задать вопрос о стоимости/);
  assert.doesNotMatch(pricing, /Оплатить онлайн/);

  const service = await (await render("/uslugi/sudebnye-spory")).text();
  assert.match(service, /после изучения ситуации/);
  assert.doesNotMatch(service, /после изучения задачи/);
});

test("renders the approved indexable practice page with honest case framing", async () => {
  const response = await render("/praktika");
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Практические ситуации/);
  assert.match(html, /Это не описания конкретных выигранных дел и не гарантия результата/);
  assert.doesNotMatch(html, /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i);
  assert.equal((html.match(/class=["'][^"']*case-card(?:\s|["'])/g) ?? []).length, 9);
});

test("keeps the administration page hidden from navigation and search", async () => {
  const home = await (await render("/")).text();
  assert.doesNotMatch(home, /href=["']\/upravlenie/);

  const adminResponse = await render("/upravlenie");
  const admin = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(admin, /Управление сайтом/);
  assert.match(admin, /noindex/);

  const robots = await render("/robots.txt");
  const robotsText = await robots.text();
  assert.match(robotsText, /Disallow: \/upravlenie/);
  assert.match(robotsText, /Sitemap: https:\/\/legservice\.ru\/sitemap\.xml/);
  assert.doesNotMatch(robotsText, /\.example|localhost|preview/i);
});

test("publishes only indexable production URLs in the sitemap", async () => {
  const response = await render("/sitemap.xml");
  const xml = await response.text();

  assert.equal(response.status, 200);
  assert.match(xml, /<loc>https:\/\/legservice\.ru\/?<\/loc>/);
  assert.doesNotMatch(xml, /\.example|localhost|preview/i);
  assert.match(xml, /<loc>https:\/\/legservice\.ru\/praktika<\/loc>/);
  assert.doesNotMatch(xml, /\/politika<\/loc>|\/soglasie<\/loc>|\/upravlenie<\/loc>/);
  for (const loc of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    assert.ok(loc[1] === "https://legservice.ru" || loc[1].startsWith("https://legservice.ru/"));
  }
});

test("requires configured PostgreSQL for administration", async () => {
  const login = await fetchApp(
    "/api/admin/login",
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ password: "test-owner-password" }),
    },
  );
  assert.equal(login.status, 503);
  const health = await (await fetchApp("/api/health")).json();
  assert.equal(health.storage, "unconfigured");
});

test("does not render the removed pre-launch note", async () => {
  for (const path of ["/politika", "/soglasie"]) {
    const response = await render(path);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex[^"']*follow[^"']*["']/i);
    assert.doesNotMatch(html, /Редакция от 29 июля 2026 года/);
    assert.doesNotMatch(html, /Перед публичным запуском документ рекомендуется проверить/);
  }
});
