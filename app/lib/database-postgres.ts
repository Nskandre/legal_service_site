import postgres from "postgres";
import {
  normalizeMarketingChannel,
  unitCost,
  type ConsultationStatus,
  type ContractStatus,
  type LeadQualification,
} from "./lead-economics";
import { takeBookingSlot, type BookingSlot } from "./booking-slots";

export type LeadStatus = "new" | "in_progress" | "done" | "declined" | "anonymized";
export type DeliveryChannel = "telegram" | "max" | "email" | "webhook";

export class BookingSlotUnavailableError extends Error {
  constructor() {
    super("Booking slot is unavailable");
    this.name = "BookingSlotUnavailableError";
  }
}

const MAX_TELEGRAM_DELIVERY_ATTEMPTS = 10;
const DEFAULT_MAX_DELIVERY_ATTEMPTS = 8;

let client: ReturnType<typeof postgres> | undefined;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  client ??= postgres(process.env.DATABASE_URL, {
    ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return client;
}

export async function getDatabaseConfig() {
  const rows = await sql()<[{ value: unknown }]>`
    SELECT value FROM site_config WHERE id = 1
  `;
  return rows[0]?.value ?? null;
}

export async function saveDatabaseConfig(value: unknown) {
  const db = sql();
  await db`
    INSERT INTO site_config (id, value, updated_at)
    VALUES (1, ${db.json(value as never)}, now())
    ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function consumeDatabaseRateLimit(key: string, maximum: number, seconds: number) {
  const rows = await sql()<[{ attempts: number }]>`
    INSERT INTO rate_limits (key, attempts, expires_at, updated_at)
    VALUES (${key}, 1, now() + (${seconds} * interval '1 second'), now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.attempts + 1 END,
      expires_at = CASE
        WHEN rate_limits.expires_at <= now() THEN now() + (${seconds} * interval '1 second')
        ELSE rate_limits.expires_at
      END,
      updated_at = now()
    RETURNING attempts
  `;
  return rows[0].attempts <= maximum;
}

export async function clearDatabaseRateLimit(key: string) {
  await sql()`DELETE FROM rate_limits WHERE key = ${key}`;
}

type CreateLeadInput = {
  name: string;
  contact: string;
  message: string;
  service: string;
  source: string;
  landing_page: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  ipHash?: string;
};

export async function createLead(input: CreateLeadInput) {
  const id = crypto.randomUUID();
  const db = sql();
  const rows = await db<[{ id: string; public_number: string; created_at: string }]>`
    INSERT INTO leads (
      id, name, contact, message, service, source, landing_page, referrer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip_hash
    )
    VALUES (
      ${id}, ${input.name}, ${input.contact}, ${input.message}, ${input.service}, ${input.source},
      ${input.landing_page || null}, ${input.referrer || null}, ${input.utm_source || null},
      ${input.utm_medium || null}, ${input.utm_campaign || null}, ${input.utm_content || null},
      ${input.utm_term || null}, ${input.ipHash ?? null}
    )
    RETURNING id, public_number, created_at
  `;
  await db`
    INSERT INTO lead_events (lead_id, event_type, details)
    VALUES (${id}, 'created', ${db.json({
      source: input.source,
      landing_page: input.landing_page || null,
      referrer: input.referrer || null,
      utm_source: input.utm_source || null,
      utm_medium: input.utm_medium || null,
      utm_campaign: input.utm_campaign || null,
      utm_content: input.utm_content || null,
      utm_term: input.utm_term || null,
    } as never)})
  `;
  return rows[0];
}

export async function createBookingLead(input: CreateLeadInput, slot: BookingSlot) {
  return sql().begin(async (transaction) => {
    const configRows = await transaction<[{ value: unknown }]>`
      SELECT value FROM site_config WHERE id = 1 FOR UPDATE
    `;
    const currentValue = configRows[0]?.value;
    const currentConfig = currentValue && typeof currentValue === "object"
      ? currentValue as Record<string, unknown>
      : null;
    const remainingSlots = takeBookingSlot(currentConfig?.bookingSlots, slot.date, slot.time);
    if (!currentConfig || !remainingSlots) throw new BookingSlotUnavailableError();

    await transaction`
      UPDATE site_config
      SET value = ${transaction.json({ ...currentConfig, bookingSlots: remainingSlots } as never)},
          updated_at = now()
      WHERE id = 1
    `;

    const id = crypto.randomUUID();
    const rows = await transaction<[{ id: string; public_number: string; created_at: string }]>`
      INSERT INTO leads (
        id, name, contact, message, service, source, landing_page, referrer,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip_hash
      )
      VALUES (
        ${id}, ${input.name}, ${input.contact}, ${input.message}, ${input.service}, ${input.source},
        ${input.landing_page || null}, ${input.referrer || null}, ${input.utm_source || null},
        ${input.utm_medium || null}, ${input.utm_campaign || null}, ${input.utm_content || null},
        ${input.utm_term || null}, ${input.ipHash ?? null}
      )
      RETURNING id, public_number, created_at
    `;
    await transaction`
      INSERT INTO lead_events (lead_id, event_type, details)
      VALUES (${id}, 'created', ${transaction.json({
        source: input.source,
        landing_page: input.landing_page || null,
        referrer: input.referrer || null,
        utm_source: input.utm_source || null,
        utm_medium: input.utm_medium || null,
        utm_campaign: input.utm_campaign || null,
        utm_content: input.utm_content || null,
        utm_term: input.utm_term || null,
        booking_slot: slot,
      } as never)})
    `;
    return rows[0];
  });
}

export async function listLeads(options: { query?: string; status?: string; limit?: number } = {}) {
  const query = options.query?.trim() ?? "";
  const status = options.status?.trim() ?? "";
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 250);
  const pattern = "%" + query + "%";
  return sql()`
    SELECT l.id, l.public_number, l.name, l.contact, l.service, l.message, l.status,
           l.notes, l.source, l.landing_page, l.referrer, l.utm_source, l.utm_medium,
           l.utm_campaign, l.utm_content, l.utm_term,
           l.qualification, l.consultation_status, l.contract_status, l.revenue_rub::float8 AS revenue_rub,
           l.created_at, l.updated_at, l.anonymized_at,
           COALESCE((
             SELECT json_agg(json_build_object(
               'channel', o.channel,
               'status', o.status,
               'attempts', o.attempts,
               'last_error', o.last_error,
               'sent_at', o.sent_at
             ) ORDER BY o.id)
             FROM delivery_outbox o
             WHERE o.lead_id = l.id
           ), '[]'::json) AS deliveries
    FROM leads l
    WHERE (${query} = '' OR l.name ILIKE ${pattern} OR l.contact ILIKE ${pattern}
           OR l.service ILIKE ${pattern} OR l.utm_source ILIKE ${pattern}
           OR l.utm_campaign ILIKE ${pattern} OR l.referrer ILIKE ${pattern}
           OR CAST(l.public_number AS text) = ${query})
      AND (${status} = '' OR l.status = ${status})
    ORDER BY l.created_at DESC
    LIMIT ${limit}
  `;
}

export async function updateLead(input: {
  id: string;
  status: LeadStatus;
  notes: string;
  qualification: LeadQualification;
  consultationStatus: ConsultationStatus;
  contractStatus: ContractStatus;
  revenueRub: number;
}) {
  const db = sql();
  const rows = await db`
    UPDATE leads
    SET status = ${input.status}, notes = ${input.notes.slice(0, 4000)},
        qualification = ${input.qualification},
        consultation_status = ${input.consultationStatus},
        contract_status = ${input.contractStatus},
        revenue_rub = ${input.revenueRub},
        updated_at = now()
    WHERE id = ${input.id} AND anonymized_at IS NULL
    RETURNING id, public_number, name, contact, service, message, status, notes, source,
              landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_content,
              utm_term, qualification, consultation_status, contract_status, revenue_rub,
              created_at, updated_at, anonymized_at
  `;
  if (!rows.length) return null;
  await db`
    INSERT INTO lead_events (lead_id, event_type, details)
    VALUES (${input.id}, 'updated', ${db.json({
      status: input.status,
      qualification: input.qualification,
      consultation_status: input.consultationStatus,
      contract_status: input.contractStatus,
      revenue_rub: input.revenueRub,
    } as never)})
  `;
  return rows[0];
}

export async function saveMarketingCost(weekStart: string, channelInput: string, spendRub: number) {
  const channel = normalizeMarketingChannel(channelInput);
  if (!channel) throw new Error("Marketing channel is required");
  const rows = await sql()`
    INSERT INTO marketing_costs (week_start, channel, spend_rub)
    VALUES (${weekStart}, ${channel}, ${spendRub})
    ON CONFLICT (week_start, channel) DO UPDATE
    SET spend_rub = EXCLUDED.spend_rub, updated_at = now()
    RETURNING week_start::text, channel, spend_rub::float8
  `;
  return rows[0];
}

export async function getWeeklyEconomics(weekStart: string) {
  const db = sql();
  const [leadRows, costRows] = await Promise.all([
    db<{
      channel: string;
      leads: number;
      target_leads: number;
      consultations: number;
      contracts: number;
      revenue_rub: number;
    }[]>`
      SELECT CASE
               WHEN NULLIF(trim(utm_source), '') IS NOT NULL THEN lower(trim(utm_source))
               WHEN NULLIF(trim(referrer), '') IS NOT NULL THEN 'referral'
               ELSE 'direct'
             END AS channel,
             count(*)::int AS leads,
             count(*) FILTER (WHERE qualification = 'target')::int AS target_leads,
             count(*) FILTER (WHERE consultation_status = 'held')::int AS consultations,
             count(*) FILTER (WHERE contract_status = 'signed')::int AS contracts,
             COALESCE(sum(revenue_rub), 0)::float8 AS revenue_rub
      FROM leads
      WHERE created_at >= (${weekStart}::date::timestamp AT TIME ZONE 'Europe/Moscow')
        AND created_at < ((${weekStart}::date + 7)::timestamp AT TIME ZONE 'Europe/Moscow')
      GROUP BY 1
    `,
    db<{ channel: string; spend_rub: number }[]>`
      SELECT channel, spend_rub::float8 AS spend_rub
      FROM marketing_costs
      WHERE week_start = ${weekStart}::date
    `,
  ]);

  const channels = new Map<string, {
    channel: string;
    leads: number;
    targetLeads: number;
    consultations: number;
    contracts: number;
    spendRub: number;
    revenueRub: number;
  }>();
  const rowFor = (channel: string) => {
    const normalized = normalizeMarketingChannel(channel) || "direct";
    if (!channels.has(normalized)) {
      channels.set(normalized, {
        channel: normalized, leads: 0, targetLeads: 0, consultations: 0,
        contracts: 0, spendRub: 0, revenueRub: 0,
      });
    }
    return channels.get(normalized)!;
  };
  for (const row of leadRows) {
    Object.assign(rowFor(row.channel), {
      leads: row.leads,
      targetLeads: row.target_leads,
      consultations: row.consultations,
      contracts: row.contracts,
      revenueRub: row.revenue_rub,
    });
  }
  for (const row of costRows) rowFor(row.channel).spendRub = row.spend_rub;

  const rows = [...channels.values()].sort((left, right) => left.channel.localeCompare(right.channel, "ru"));
  const decorate = (row: (typeof rows)[number]) => ({
    ...row,
    cplRub: unitCost(row.spendRub, row.leads),
    targetLeadCostRub: unitCost(row.spendRub, row.targetLeads),
    cacRub: unitCost(row.spendRub, row.contracts),
  });
  const total = rows.reduce((result, row) => ({
    channel: "total",
    leads: result.leads + row.leads,
    targetLeads: result.targetLeads + row.targetLeads,
    consultations: result.consultations + row.consultations,
    contracts: result.contracts + row.contracts,
    spendRub: result.spendRub + row.spendRub,
    revenueRub: result.revenueRub + row.revenueRub,
  }), {
    channel: "total", leads: 0, targetLeads: 0, consultations: 0,
    contracts: 0, spendRub: 0, revenueRub: 0,
  });
  return { weekStart, rows: rows.map(decorate), total: decorate(total) };
}

export async function anonymizeLead(id: string) {
  const db = sql();
  const rows = await db`
    UPDATE leads
    SET name = 'Удалено', contact = 'Удалено', message = 'Удалено',
        notes = '', status = 'anonymized', anonymized_at = now(), updated_at = now()
    WHERE id = ${id} AND anonymized_at IS NULL
    RETURNING id
  `;
  if (rows.length) {
    await db`
      INSERT INTO lead_events (lead_id, event_type, details)
      VALUES (${id}, 'anonymized', '{}'::jsonb)
    `;
  }
  return Boolean(rows.length);
}

export async function deleteLeads(ids: string[], resetCounter = false) {
  if (!ids.length && !resetCounter) return { deleted: 0, counterReset: false };

  return sql().begin(async (transaction) => {
    if (resetCounter) {
      await transaction`LOCK TABLE leads IN ACCESS EXCLUSIVE MODE`;
    }

    let deleted = 0;
    if (ids.length) {
      const rows = await transaction`
        DELETE FROM leads
        WHERE id = ANY(${ids})
        RETURNING id
      `;
      deleted = rows.length;
    }

    let counterReset = false;
    if (resetCounter) {
      const remaining = await transaction<[{ count: string }]>`
        SELECT count(*)::text AS count FROM leads
      `;
      if (Number(remaining[0]?.count ?? 0) === 0) {
        await transaction`ALTER TABLE leads ALTER COLUMN public_number RESTART WITH 1`;
        counterReset = true;
      }
    }

    return { deleted, counterReset };
  });
}

export async function anonymizeExpiredLeads(days: number) {
  if (!Number.isFinite(days) || days < 1) return 0;
  const rows = await sql()`
    UPDATE leads
    SET name = 'Удалено', contact = 'Удалено', message = 'Удалено',
        notes = '', status = 'anonymized', anonymized_at = now(), updated_at = now()
    WHERE anonymized_at IS NULL
      AND created_at < now() - (${Math.floor(days)} * interval '1 day')
    RETURNING id
  `;
  return rows.length;
}

export async function queueDelivery(leadId: string, channel: DeliveryChannel) {
  await sql()`
    INSERT INTO delivery_outbox (lead_id, channel)
    VALUES (${leadId}, ${channel})
    ON CONFLICT (lead_id, channel) DO NOTHING
  `;
}

export async function pendingDeliveries(channels: DeliveryChannel[], limit = 20) {
  if (!channels.length) return [];
  return sql()`
    SELECT o.id, o.lead_id, o.channel, o.attempts,
           l.public_number, l.name, l.contact, l.message, l.service, l.source,
           l.landing_page, l.referrer, l.utm_source, l.utm_medium, l.utm_campaign,
           l.utm_content, l.utm_term, l.created_at
    FROM delivery_outbox o
    JOIN leads l ON l.id = o.lead_id
    WHERE o.status IN ('pending', 'failed')
      AND o.channel = ANY(${channels})
      AND o.next_attempt_at <= now()
      AND o.attempts < CASE
        WHEN o.channel = 'telegram' THEN CAST(${MAX_TELEGRAM_DELIVERY_ATTEMPTS} AS integer)
        ELSE CAST(${DEFAULT_MAX_DELIVERY_ATTEMPTS} AS integer)
      END
      AND (
        o.channel <> 'telegram'
        OR NOT EXISTS (
          SELECT 1
          FROM delivery_outbox AS delivered_email
          WHERE delivered_email.lead_id = o.lead_id
            AND delivered_email.channel = 'email'
            AND delivered_email.status = 'sent'
        )
      )
    ORDER BY o.next_attempt_at, o.id
    LIMIT ${limit}
  `;
}

export async function retryTestDeliveries(channels: DeliveryChannel[]) {
  if (!channels.length) return 0;
  const rows = await sql()`
    UPDATE delivery_outbox AS o
    SET status = 'pending', attempts = 0, next_attempt_at = now(),
        last_error = NULL, updated_at = now()
    FROM leads AS l
    WHERE o.lead_id = l.id
      AND o.channel = ANY(${channels})
      AND o.status = 'failed'
      AND l.contact LIKE 'test-%@example.invalid'
      AND l.service LIKE '%D-013%'
    RETURNING o.id
  `;
  return rows.length;
}

export async function markDeliverySent(id: number) {
  await sql()`
    UPDATE delivery_outbox
    SET status = 'sent', attempts = attempts + 1, sent_at = now(),
        last_error = NULL, updated_at = now()
    WHERE id = ${id}
      AND status IN ('pending', 'failed')
  `;
}

export async function markDeliveryFailed(id: number, attempts: number, error: string) {
  const delaySeconds = Math.min(60 * (2 ** Math.max(attempts, 0)), 21600);
  await sql()`
    UPDATE delivery_outbox
    SET status = 'failed', attempts = attempts + 1,
        next_attempt_at = now() + (${delaySeconds} * interval '1 second'),
        last_error = ${error.slice(0, 1000)}, updated_at = now()
    WHERE id = ${id}
      AND status IN ('pending', 'failed')
  `;
}

export async function databaseHealth() {
  try {
    const rows = await sql()<[{ healthy: number }]>`SELECT 1 AS healthy`;
    return rows[0]?.healthy === 1;
  } catch {
    return false;
  }
}
