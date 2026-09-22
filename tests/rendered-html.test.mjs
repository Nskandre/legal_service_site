import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
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
  assert.match(home, /Записаться на очную консультацию/);
  assert.match(
    home,
    /Информация на страницах сайта не является индивидуальной юридической консультацией и не содержит гарантии результата по делу\./,
  );
  assert.match(home, /https:\/\/t\.me\/\+79398456395/);
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

test("does not render the removed pre-launch note", async () => {
  for (const path of ["/politika", "/soglasie"]) {
    const response = await render(path);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(html, /Редакция от 29 июля 2026 года/);
    assert.doesNotMatch(html, /Перед публичным запуском документ рекомендуется проверить/);
  }
});
