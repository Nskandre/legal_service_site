import assert from "node:assert/strict";
import test from "node:test";
import { configuredDeliveryChannels } from "../app/lib/notification-channels.ts";

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
