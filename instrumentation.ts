export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { flushPendingNotifications } = await import("./app/lib/lead-notifications");
  setInterval(() => void flushPendingNotifications(), 60_000).unref();
}
