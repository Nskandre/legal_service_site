import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const attributionSource = await readFile(new URL("../app/lib/lead-attribution.ts", import.meta.url), "utf8");
const leadFormSource = await readFile(new URL("../app/components/LeadForm.tsx", import.meta.url), "utf8");
const bookingFormSource = await readFile(new URL("../app/components/BookingForm.tsx", import.meta.url), "utf8");
const shellSource = await readFile(new URL("../app/components/SiteShell.tsx", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../app/api/lead/route.ts", import.meta.url), "utf8");
const databaseSource = await readFile(new URL("../app/lib/database-postgres.ts", import.meta.url), "utf8");
const notificationSource = await readFile(new URL("../app/lib/lead-notifications.ts", import.meta.url), "utf8");
const adminSource = await readFile(new URL("../app/upravlenie/AdminPanel.tsx", import.meta.url), "utf8");
const migrationSource = await readFile(new URL("../migrations/002_lead_attribution.sql", import.meta.url), "utf8");

const clientUtmFields = ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"];
const databaseFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

test("captures first-touch attribution once per browser tab", () => {
  assert.match(shellSource, /captureLeadAttribution\(\)/);
  assert.match(attributionSource, /window\.sessionStorage\.getItem\(storageKey\)/);
  assert.match(attributionSource, /window\.sessionStorage\.setItem\(storageKey/);
  assert.match(attributionSource, /landingPage: window\.location\.pathname/);
  assert.doesNotMatch(attributionSource, /landingPage: window\.location\.href/);
  for (const field of clientUtmFields) assert.match(attributionSource, new RegExp(field));
});

test("sends the same attribution contract from both forms", () => {
  assert.match(leadFormSource, /getLeadAttribution\(\)/);
  assert.match(bookingFormSource, /getLeadAttribution\(\)/);
});

test("cleans landing page, referrer and UTM on the server", () => {
  assert.match(routeSource, /cleanLandingPage\(body\.landingPage\)/);
  assert.match(routeSource, /cleanReferrer\(body\.referrer/);
  for (const field of clientUtmFields) {
    assert.match(routeSource, new RegExp(`cleanAttribution\\(body\\.${field}\\)`));
  }
});

test("adds nullable attribution columns and persists them separately", () => {
  for (const field of ["landing_page", "referrer", ...databaseFields]) {
    assert.match(migrationSource, new RegExp(`ADD COLUMN IF NOT EXISTS ${field} text`));
    assert.match(databaseSource, new RegExp(field));
  }
  assert.match(databaseSource, /source, landing_page, referrer/);
});

test("shows attribution in the journal and the complete email", () => {
  for (const label of ["Тип формы", "Точка входа", "Referrer", "UTM-метки"]) {
    assert.match(adminSource, new RegExp(label));
  }
  assert.match(adminSource, /Без UTM/);
  assert.match(notificationSource, /"UTM: " \+ utm/);
});
