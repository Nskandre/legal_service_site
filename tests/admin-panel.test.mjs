import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminSource = await readFile(new URL("../app/upravlenie/AdminPanel.tsx", import.meta.url), "utf8");
const databaseSource = await readFile(new URL("../app/lib/database-postgres.ts", import.meta.url), "utf8");

test("provides quick navigation to every administration section", () => {
  for (const id of ["admin-leads", "admin-contacts", "admin-pricing", "admin-slots"]) {
    assert.match(adminSource, new RegExp(`href="#${id}"`));
    assert.match(adminSource, new RegExp(`id="${id}"`));
  }
  for (const label of ["Журнал заявок", "Контакты", "Стаж и цены", "Свободное время"]) {
    assert.match(adminSource, new RegExp(`>${label}<`));
  }
});

test("restricts permanent deletion to D-013 test leads", () => {
  assert.match(databaseSource, /contact LIKE 'test-%@example\.invalid'/);
  assert.match(databaseSource, /service LIKE '%D-013%'/);
});
