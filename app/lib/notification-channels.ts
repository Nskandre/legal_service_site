export type ActiveDeliveryChannel = "telegram" | "max" | "webhook";

export function configuredDeliveryChannels(
  env: Record<string, string | undefined> = process.env,
): ActiveDeliveryChannel[] {
  const channels: ActiveDeliveryChannel[] = [];
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) channels.push("telegram");
  if (env.MAX_BOT_TOKEN && env.MAX_CHAT_ID) channels.push("max");
  if (env.LEAD_WEBHOOK_URL) channels.push("webhook");
  return channels;
}
