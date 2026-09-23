import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        url: `data:text/javascript,${encodeURIComponent("export const env = new Proxy({}, { get: (_, key) => globalThis.__CLOUDFLARE_TEST_ENV__?.[key] });")}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

function defaultRuntimeEnv() {
  return {
    SITE_CONFIG: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
}

async function fetchWorker(path = "/", init = {}, runtimeEnv = defaultRuntimeEnv()) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  globalThis.__CLOUDFLARE_TEST_ENV__ = runtimeEnv;
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    runtimeEnv,
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function render(path = "/") {
  return fetchWorker(path, { headers: { accept: "text/html" } });
}

test("renders development preview metadata", async () => {
  const response = await render();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
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
  assert.match(contacts, /rinf@bk\.ru/);
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

test("keeps the administration page hidden from navigation and search", async () => {
  const home = await (await render("/")).text();
  assert.doesNotMatch(home, /href=["']\/upravlenie/);

  const adminResponse = await render("/upravlenie");
  const admin = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(admin, /Управление сайтом/);
  assert.match(admin, /noindex/);

  const robots = await render("/robots.txt");
  assert.match(await robots.text(), /Disallow: \/upravlenie/);
});

test("authenticates the owner and persists validated administration settings", async () => {
  const values = new Map();
  const runtimeEnv = {
    ADMIN_PASSWORD: "test-owner-password",
    ADMIN_SESSION_SECRET: "test-session-secret-with-sufficient-length",
    SITE_CONFIG: {
      get: async (key) => values.has(key) ? JSON.parse(values.get(key)) : null,
      put: async (key, value) => values.set(key, value),
      delete: async (key) => values.delete(key),
    },
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };

  const login = await fetchWorker(
    "/api/admin/login",
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ password: "test-owner-password" }),
    },
    runtimeEnv,
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";", 1)[0];

  const current = await fetchWorker("/api/admin/config", { headers: { cookie } }, runtimeEnv);
  assert.equal(current.status, 200);
  const { config } = await current.json();
  config.experienceYears = "16+ лет";
  config.bookingSlots = [{ date: "2030-05-12", time: "14:30" }];

  const saved = await fetchWorker(
    "/api/admin/config",
    {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost", cookie },
      body: JSON.stringify(config),
    },
    runtimeEnv,
  );
  assert.equal(saved.status, 200);
  assert.equal(JSON.parse(values.get("public-site-config")).experienceYears, "16+ лет");
  assert.deepEqual(JSON.parse(values.get("public-site-config")).bookingSlots, [{ date: "2030-05-12", time: "14:30" }]);
});

test("does not render the removed pre-launch note", async () => {
  for (const path of ["/politika", "/soglasie"]) {
    const response = await render(path);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(html, /Редакция от 29 июля 2026 года/);
    assert.doesNotMatch(html, /Перед публичным запуском документ рекомендуется проверить/);
  }
});
