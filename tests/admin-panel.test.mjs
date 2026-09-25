import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminSource = await readFile(new URL("../app/upravlenie/AdminPanel.tsx", import.meta.url), "utf8");
const databaseSource = await readFile(new URL("../app/lib/database-postgres.ts", import.meta.url), "utf8");
const leadsRouteSource = await readFile(new URL("../app/api/admin/leads/route.ts", import.meta.url), "utf8");

test("provides quick navigation to every administration section", () => {
  for (const id of ["admin-leads", "admin-contacts", "admin-pricing", "admin-slots"]) {
    assert.match(adminSource, new RegExp(`href="#${id}"`));
    assert.match(adminSource, new RegExp(`id="${id}"`));
  }
  for (const label of ["Журнал заявок", "Контакты", "Стаж и цены", "Свободное время"]) {
    assert.match(adminSource, new RegExp(`>${label}<`));
  }
});

test("provides authenticated batch deletion with bounded UUID input", () => {
  assert.match(leadsRouteSource, /export async function DELETE/);
  assert.match(leadsRouteSource, /sameOrigin\(request\)/);
  assert.match(leadsRouteSource, /isAdmin\(request\)/);
  assert.match(leadsRouteSource, /body\.ids\.length > 100/);
  assert.match(leadsRouteSource, /uuidPattern\.test\(id\)/);
  assert.match(leadsRouteSource, /!body\.ids\.length && !resetCounter/);
  assert.match(leadsRouteSource, /deleteLeads\(ids, resetCounter\)/);
  assert.match(leadsRouteSource, /journal_not_empty/);
});

test("lets the administrator select and permanently delete visible leads", () => {
  assert.match(adminSource, /selectedLeadIds/);
  assert.match(adminSource, /Выбрать все показанные/);
  assert.match(adminSource, /Удалить выбранные/);
  assert.match(adminSource, /method: "DELETE"/);
  assert.match(adminSource, /JSON\.stringify\(\{ ids: selectedLeadIds \}\)/);
  assert.match(adminSource, /без возможности восстановления/);
  assert.match(adminSource, /Сбросить нумерацию заявок/);
  assert.match(adminSource, /JSON\.stringify\(\{ ids: \[\], resetCounter: true \}\)/);
  assert.match(adminSource, /Нумерацию можно сбросить только после удаления всех заявок/);
});

test("resets public numbering only after the lead journal becomes empty", () => {
  assert.match(databaseSource, /LOCK TABLE leads IN ACCESS EXCLUSIVE MODE/);
  assert.match(databaseSource, /SELECT count\(\*\)::text AS count FROM leads/);
  assert.match(databaseSource, /Number\(remaining\[0\]\?\.count \?\? 0\) === 0/);
  assert.match(databaseSource, /ALTER TABLE leads ALTER COLUMN public_number RESTART WITH 1/);
});
test("restricts manual notification retry to authenticated D-013 test leads", () => {
  assert.match(databaseSource, /export async function retryTestDeliveries/);
  assert.match(databaseSource, /l\.contact LIKE 'test-%@example\.invalid'/);
  assert.match(databaseSource, /l\.service LIKE '%D-013%'/);
  assert.match(leadsRouteSource, /export async function POST/);
  assert.match(leadsRouteSource, /sameOrigin\(request\)/);
  assert.match(leadsRouteSource, /isAdmin\(request\)/);
  assert.match(leadsRouteSource, /retryTestDeliveries\(channels\)/);
});
