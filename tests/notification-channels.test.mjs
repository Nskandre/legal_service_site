import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { configuredDeliveryChannels, requestWithRetry } from "../app/lib/notification-channels.ts";

const notificationSource = await readFile(new URL("../app/lib/lead-notifications.ts", import.meta.url), "utf8");
const leadFormSource = await readFile(new URL("../app/components/LeadForm.tsx", import.meta.url), "utf8");
const siteShellSource = await readFile(new URL("../app/components/SiteShell.tsx", import.meta.url), "utf8");
const smtpSource = await readFile(new URL("../app/lib/smtp-email.ts", import.meta.url), "utf8");

test("uses Telegram when both credentials are configured", () => {
  assert.deepEqual(configuredDeliveryChannels({
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_CHAT_ID: "test-chat",
  }), ["telegram"]);
});

test("does not enable incomplete notification channels", () => {
  assert.deepEqual(configuredDeliveryChannels({
    TELEGRAM_BOT_TOKEN: "test-token",
    MAX_CHAT_ID: "test-chat",
  }), []);
});

test("uses DashaMail email only when all required settings are configured", () => {
  assert.deepEqual(configuredDeliveryChannels({
    DASHAMAIL_API_KEY: "test-key",
    EMAIL_FROM: "notifications@example.test",
    LEAD_NOTIFICATION_EMAIL: "owner@example.test",
  }), ["email"]);

  assert.deepEqual(configuredDeliveryChannels({
    DASHAMAIL_API_KEY: "test-key",
    LEAD_NOTIFICATION_EMAIL: "owner@example.test",
  }), []);

  assert.deepEqual(configuredDeliveryChannels({
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_USER: "sender@example.test",
    SMTP_PASSWORD: "test-password",
    SMTP_FROM: "sender@example.test",
    LEAD_NOTIFICATION_EMAIL: "owner@example.test",
  }), ["email"]);
});

test("keeps MAX and webhook available when fully configured", () => {
  assert.deepEqual(configuredDeliveryChannels({
    MAX_BOT_TOKEN: "test-token",
    MAX_CHAT_ID: "test-chat",
    LEAD_WEBHOOK_URL: "https://example.test/hook",
  }), ["max", "webhook"]);
});

test("sends privacy-safe DashaMail notifications with a stable message id", () => {
  assert.match(notificationSource, /api\.dashamail\.com\/v2\/transactional\/messages/);
  assert.match(notificationSource, /LEAD_NOTIFICATION_EMAIL/);
  assert.match(notificationSource, /EMAIL_FROM/);
  assert.match(notificationSource, /legservice-lead-\$\{item\.public_number\}-delivery-\$\{item\.id\}/);
  assert.doesNotMatch(notificationSource, /item\.(name|contact|message)/);
});

test("keeps a stable form reference across the asynchronous submission", () => {
  assert.match(leadFormSource, /const formElement = event\.currentTarget/);
  assert.match(leadFormSource, /new FormData\(formElement\)/);
  assert.match(leadFormSource, /formElement\.reset\(\)/);
  assert.doesNotMatch(leadFormSource, /event\.currentTarget\.reset\(\)/);
});

test("closes lead and booking dialogs with Escape", () => {
  assert.match(siteShellSource, /event\.key !== "Escape"/);
  assert.match(siteShellSource, /setDialogOpen\(false\)/);
  assert.match(siteShellSource, /setBookingOpen\(false\)/);
  assert.match(siteShellSource, /window\.addEventListener\("keydown", closeOnEscape\)/);
});

test("SMTP fallback requires TLS and keeps the message privacy-safe", () => {
  assert.match(smtpSource, /STARTTLS/);
  assert.match(smtpSource, /tls\.connect/);
  assert.match(smtpSource, /Content-Transfer-Encoding: base64/);
  assert.doesNotMatch(smtpSource, /item\.(name|contact|message)/);
});

test("retries transient network failures", async () => {
  let calls = 0;
  const delays = [];
  const response = await requestWithRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error("temporary timeout");
    return new Response(null, { status: 204 });
  }, {
    delayMs: 10,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  assert.equal(response.status, 204);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("retries rate limits and server errors", async () => {
  const statuses = [429, 503, 200];
  let calls = 0;
  const response = await requestWithRetry(async () => {
    const status = statuses[calls];
    calls += 1;
    return new Response(null, { status });
  }, { sleep: async () => {} });

  assert.equal(response.status, 200);
  assert.equal(calls, 3);
});

test("does not retry permanent client errors", async () => {
  let calls = 0;
  const response = await requestWithRetry(async () => {
    calls += 1;
    return new Response(null, { status: 401 });
  }, { sleep: async () => {} });

  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});

test("throws after the final transient failure", async () => {
  let calls = 0;
  await assert.rejects(() => requestWithRetry(async () => {
    calls += 1;
    throw new Error("timeout");
  }, { sleep: async () => {} }), /timeout/);
  assert.equal(calls, 3);
});
