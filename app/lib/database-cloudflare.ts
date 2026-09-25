export type LeadStatus = "new" | "in_progress" | "done" | "declined" | "anonymized";
export type DeliveryChannel = "telegram" | "max" | "email" | "webhook";

export const databaseConfigured = () => false;

function unavailable(): never {
  throw new Error("PostgreSQL is unavailable in the Cloudflare fallback build");
}

export const getDatabaseConfig = async () => null;
export const saveDatabaseConfig: (value: unknown) => Promise<void> = async () => unavailable();
export const consumeDatabaseRateLimit: (key: string, maximum: number, seconds: number) => Promise<boolean> = async () => unavailable();
export const clearDatabaseRateLimit: (key: string) => Promise<void> = async () => unavailable();
export const createLead: (input: unknown) => Promise<{
  id: string;
  public_number: string;
  created_at: string;
}> = async () => unavailable();
export const listLeads: (options?: unknown) => Promise<unknown[]> = async () => unavailable();
export const updateLead: (id: string, status: LeadStatus, notes: string) => Promise<unknown> = async () => unavailable();
export const anonymizeLead: (id: string) => Promise<boolean> = async () => unavailable();
export const anonymizeExpiredLeads: (days: number) => Promise<number> = async () => 0;
export const queueDelivery: (leadId: string, channel: DeliveryChannel) => Promise<void> = async () => unavailable();
export const pendingDeliveries: (channels: DeliveryChannel[], limit?: number) => Promise<unknown[]> = async () => [];
export const markDeliverySent: (id: number) => Promise<void> = async () => unavailable();
export const markDeliveryFailed: (id: number, attempts: number, error: string) => Promise<void> = async () => unavailable();
export const databaseHealth = async () => false;
