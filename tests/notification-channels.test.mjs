import assert from "node:assert/strict";
import test from "node:test";
import { configuredDeliveryChannels, requestWithRetry } from "../app/lib/notification-channels.ts";

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

test("does not enable deferred email settings", () => {
  assert.deepEqual(configuredDeliveryChannels({
    SMTP_HOST: "smtp.example.test",
    SMTP_USER: "sender@example.test",
    SMTP_PASSWORD: "secret",
    DASHAMAIL_API_KEY: "test-key",
    EMAIL_FROM: "notifications@example.test",
    LEAD_NOTIFICATION_EMAIL: "owner@example.test",
  }), []);
});

test("keeps MAX and webhook available when fully configured", () => {
  assert.deepEqual(configuredDeliveryChannels({
    MAX_BOT_TOKEN: "test-token",
    MAX_CHAT_ID: "test-chat",
    LEAD_WEBHOOK_URL: "https://example.test/hook",
  }), ["max", "webhook"]);
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
