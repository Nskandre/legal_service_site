import postgres from "postgres";

export type LeadStatus = "new" | "in_progress" | "done" | "declined" | "anonymized";
export type DeliveryChannel = "telegram" | "max" | "email" | "webhook";

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

export async function createLead(input: {
  name: string;
  contact: string;
  message: string;
  service: string;
  source: string;
  ipHash?: string;
}) {
  const id = crypto.randomUUID();
  const db = sql();
  const rows = await db<[{ id: string; public_number: string; created_at: string }]>`
    INSERT INTO leads (id, name, contact, message, service, source, ip_hash)
    VALUES (${id}, ${input.name}, ${input.contact}, ${input.message}, ${input.service}, ${input.source}, ${input.ipHash ?? null})
    RETURNING id, public_number, created_at
  `;
  await db`
    INSERT INTO lead_events (lead_id, event_type, details)
    VALUES (${id}, 'created', ${db.json({ source: input.source } as never)})
  `;
  return rows[0];
}

export async function listLeads(options: { query?: string; status?: string; limit?: number } = {}) {
  const query = options.query?.trim() ?? "";
  const status = options.status?.trim() ?? "";
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 250);
  const pattern = "%" + query + "%";
  return sql()`
    SELECT l.id, l.public_number, l.name, l.contact, l.service, l.message, l.status,
           l.notes, l.source, l.created_at, l.updated_at, l.anonymized_at,
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
           OR l.service ILIKE ${pattern} OR CAST(l.public_number AS text) = ${query})
      AND (${status} = '' OR l.status = ${status})
    ORDER BY l.created_at DESC
    LIMIT ${limit}
  `;
}

export async function updateLead(id: string, status: LeadStatus, notes: string) {
  const db = sql();
  const rows = await db`
    UPDATE leads
    SET status = ${status}, notes = ${notes.slice(0, 4000)}, updated_at = now()
    WHERE id = ${id} AND anonymized_at IS NULL
    RETURNING id, public_number, name, contact, service, message, status, notes, source,
              created_at, updated_at, anonymized_at
  `;
  if (!rows.length) return null;
  await db`
    INSERT INTO lead_events (lead_id, event_type, details)
    VALUES (${id}, 'updated', ${db.json({ status } as never)})
  `;
  return rows[0];
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
    SELECT o.id, o.lead_id, o.channel, o.attempts, l.public_number
    FROM delivery_outbox o
    JOIN leads l ON l.id = o.lead_id
    WHERE o.status IN ('pending', 'failed')
      AND o.channel = ANY(${channels})
      AND o.next_attempt_at <= now()
      AND o.attempts < 8
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
