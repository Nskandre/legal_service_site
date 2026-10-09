import { contacts, pricingItems, services } from "./content";
import { normalizeBookingSlots, type BookingSlot } from "./booking-slots";
import {
  databaseConfigured,
  getDatabaseConfig,
  saveDatabaseConfig,
} from "@runtime/database";

export type { BookingSlot } from "./booking-slots";

export type SiteConfig = {
  contacts: typeof contacts;
  experienceYears: string;
  servicePrices: Record<string, string>;
  pricingPrices: Record<string, string>;
  bookingSlots: BookingSlot[];
};

export const defaultSiteConfig: SiteConfig = {
  contacts,
  experienceYears: "15+ лет",
  servicePrices: Object.fromEntries(services.map((service) => [service.slug, service.price])),
  pricingPrices: Object.fromEntries(pricingItems.map((item) => [item.id, item.price])),
  bookingSlots: [],
};

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

  const bookingSlots = normalizeBookingSlots(source.bookingSlots);

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
    return defaultSiteConfig;
  } catch {
    return defaultSiteConfig;
  }
}

export async function saveSiteConfig(value: unknown) {
  const normalized = normalizeSiteConfig(value);
  if (!databaseConfigured()) throw new Error("PostgreSQL is not configured");
  await saveDatabaseConfig(normalized);
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
