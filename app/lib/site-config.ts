import { runtimeEnv as env } from "@runtime/environment";
import { contacts, pricingItems, services } from "./content";
import {
  databaseConfigured,
  getDatabaseConfig,
  saveDatabaseConfig,
} from "@runtime/database";

export type BookingSlot = { date: string; time: string };

export type SiteConfig = {
  contacts: typeof contacts;
  experienceYears: string;
  servicePrices: Record<string, string>;
  pricingPrices: Record<string, string>;
  bookingSlots: BookingSlot[];
};

type KvBinding = {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type WorkerBindings = {
  SITE_CONFIG?: KvBinding;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

export const defaultSiteConfig: SiteConfig = {
  contacts,
  experienceYears: "15+ лет",
  servicePrices: Object.fromEntries(services.map((service) => [service.slug, service.price])),
  pricingPrices: Object.fromEntries(pricingItems.map((item) => [item.id, item.price])),
  bookingSlots: [],
};

export function workerBindings() {
  return env as unknown as WorkerBindings;
}

function safeText(value: unknown, fallback: string, max = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

export function normalizeSiteConfig(value: unknown): SiteConfig {
  const source = value && typeof value === "object" ? (value as Partial<SiteConfig>) : {};
  const sourceContacts = source.contacts && typeof source.contacts === "object" ? source.contacts : contacts;
  const servicePrices = { ...defaultSiteConfig.servicePrices };
  const pricingPrices = { ...defaultSiteConfig.pricingPrices };

  for (const service of services) {
    servicePrices[service.slug] = safeText(source.servicePrices?.[service.slug], service.price, 80);
  }
  for (const item of pricingItems) {
    pricingPrices[item.id] = safeText(source.pricingPrices?.[item.id], item.price, 80);
  }

  const bookingSlots = Array.isArray(source.bookingSlots)
    ? source.bookingSlots
        .filter((slot): slot is BookingSlot => Boolean(slot && /^\d{4}-\d{2}-\d{2}$/.test(slot.date) && /^\d{2}:\d{2}$/.test(slot.time)))
        .slice(0, 180)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    : [];

  return {
    contacts: {
      phoneDisplay: safeText(sourceContacts.phoneDisplay, contacts.phoneDisplay, 40),
      phone: safeText(sourceContacts.phone, contacts.phone, 30),
      email: safeText(sourceContacts.email, contacts.email, 120),
      telegram: safeText(sourceContacts.telegram, contacts.telegram, 500),
      max: safeText(sourceContacts.max, contacts.max, 500),
      location: safeText(sourceContacts.location, contacts.location, 160),
      workFormat: safeText(sourceContacts.workFormat, contacts.workFormat, 200),
    },
    experienceYears: safeText(source.experienceYears, defaultSiteConfig.experienceYears, 40),
    servicePrices,
    pricingPrices,
    bookingSlots,
  };
}

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    if (databaseConfigured()) {
      return normalizeSiteConfig(await getDatabaseConfig());
    }
    const kv = workerBindings().SITE_CONFIG;
    if (!kv) return defaultSiteConfig;
    return normalizeSiteConfig(await kv.get("public-site-config", "json"));
  } catch {
    return defaultSiteConfig;
  }
}

export async function saveSiteConfig(value: unknown) {
  const normalized = normalizeSiteConfig(value);
  if (databaseConfigured()) {
    await saveDatabaseConfig(normalized);
    return normalized;
  }
  const kv = workerBindings().SITE_CONFIG;
  if (!kv) throw new Error("SITE_CONFIG binding is not configured");
  await kv.put("public-site-config", JSON.stringify(normalized));
  return normalized;
}

export function configuredServices(config: SiteConfig) {
  return services.map((service) => ({
    ...service,
    price: config.servicePrices[service.slug] || service.price,
  }));
}

export function configuredPricing(config: SiteConfig) {
  return pricingItems.map((item) => ({
    ...item,
    price: config.pricingPrices[item.id] || item.price,
  }));
}
