import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeMarketingChannel, unitCost } from "../app/lib/lead-economics.ts";

const databaseSource = await readFile(new URL("../app/lib/database-postgres.ts", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/admin/economics/route.ts", import.meta.url), "utf8");
const leadsRouteSource = await readFile(new URL("../app/api/admin/leads/route.ts", import.meta.url), "utf8");
const migrationSource = await readFile(new URL("../migrations/003_lead_qualification_economics.sql", import.meta.url), "utf8");
const adminSource = await readFile(new URL("../app/upravlenie/AdminPanel.tsx", import.meta.url), "utf8");

test("normalizes manual marketing channels to the same safe key", () => {
  assert.equal(normalizeMarketingChannel("  Yandex CPC  "), "yandex-cpc");
  assert.equal(normalizeMarketingChannel("ВК / реклама"), "вк-реклама");
  assert.equal(normalizeMarketingChannel(" --- "), "");
  assert.equal(normalizeMarketingChannel("a".repeat(80)).length, 60);
});

test("calculates CPL and CAC without inventing a value for zero conversions", () => {
  assert.equal(unitCost(12_345.67, 10), 1234.57);
  assert.equal(unitCost(5000, 2), 2500);
  assert.equal(unitCost(5000, 0), null);
  assert.equal(unitCost(-1, 1), null);
});

test("stores independent funnel facts and non-negative exact revenue", () => {
  for (const column of ["qualification", "consultation_status", "contract_status", "revenue_rub"]) {
    assert.match(migrationSource, new RegExp(column));
    assert.match(databaseSource, new RegExp(column));
  }
  assert.match(migrationSource, /CHECK \(revenue_rub >= 0\)/);
  assert.match(leadsRouteSource, /body\.revenueRub < 0/);
  assert.match(leadsRouteSource, /Math\.round\(body\.revenueRub \* 100\)/);
});

test("protects weekly cost writes and returns aggregate analytics only", () => {
  assert.match(routeSource, /isAdmin\(request\)/);
  assert.match(routeSource, /sameOrigin\(request\)/);
  assert.match(routeSource, /validWeekStart/);
  assert.match(routeSource, /saveMarketingCost/);
  const aggregateFunction = databaseSource.slice(
    databaseSource.indexOf("export async function getWeeklyEconomics"),
    databaseSource.indexOf("export async function anonymizeLead"),
  );
  for (const personalField of ["l.name", "l.contact", "l.message", "notes"]) {
    assert.doesNotMatch(aggregateFunction, new RegExp(personalField.replace(".", "\\.")));
  }
});

test("exposes the complete source-to-economics chain in the protected interface", () => {
  for (const label of ["Квалификация", "Консультация", "Договор", "Фактическая выручка", "CPL", "CAC"]) {
    assert.match(adminSource, new RegExp(label));
  }
  assert.match(adminSource, /utm_source/);
  assert.match(adminSource, /Недельная сводка содержит только количества и суммы, без персональных данных/);
});
