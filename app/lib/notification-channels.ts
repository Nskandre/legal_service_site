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

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function requestWithRetry(
  request: () => Promise<Response>,
  options: RetryOptions = {},
) {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = Math.max(0, options.delayMs ?? 750);
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request();
      if (response.ok || (response.status !== 429 && response.status < 500)) return response;
      lastError = new Error(`Notification service returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(delayMs * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Notification request failed");
}
