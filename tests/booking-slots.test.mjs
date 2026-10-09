import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeBookingSlots, takeBookingSlot } from "../app/lib/booking-slots.ts";

const bookingFormSource = await readFile(new URL("../app/components/BookingForm.tsx", import.meta.url), "utf8");
const leadRouteSource = await readFile(new URL("../app/api/lead/route.ts", import.meta.url), "utf8");
const databaseSource = await readFile(new URL("../app/lib/database-postgres.ts", import.meta.url), "utf8");
const adminPanelSource = await readFile(new URL("../app/upravlenie/AdminPanel.tsx", import.meta.url), "utf8");

test("normalizes booking slots and removes the selected slot", () => {
  const slots = normalizeBookingSlots([
    { date: "2026-10-12", time: "11:20" },
    { date: "invalid", time: "11:00" },
    { date: "2026-10-11", time: "09:10" },
  ]);
  assert.deepEqual(slots, [
    { date: "2026-10-11", time: "09:10" },
    { date: "2026-10-12", time: "11:20" },
  ]);
  assert.deepEqual(takeBookingSlot(slots, "2026-10-11", "09:10"), [
    { date: "2026-10-12", time: "11:20" },
  ]);
  assert.equal(takeBookingSlot(slots, "2026-10-11", "09:00"), null);
});

test("booking form sends a structured slot through the shared lead endpoint", () => {
  assert.match(bookingFormSource, /bookingDate: selectedDate/);
  assert.match(bookingFormSource, /bookingTime: selectedTime/);
  assert.match(bookingFormSource, /bookingMethod: method/);
  assert.match(bookingFormSource, /fetch\("\/api\/lead"/);
  assert.match(leadRouteSource, /source === "booking"/);
  assert.match(leadRouteSource, /createBookingLead\(leadInput, bookingSlot\)/);
  assert.match(leadRouteSource, /Этот слот уже занят/);
});

test("booking is atomic and the admin time picker uses ten-minute increments", () => {
  assert.match(databaseSource, /SELECT value FROM site_config WHERE id = 1 FOR UPDATE/);
  assert.match(databaseSource, /bookingSlots: remainingSlots/);
  assert.match(databaseSource, /INSERT INTO leads/);
  assert.match(databaseSource, /booking_slot: slot/);
  assert.match(adminPanelSource, /type="time" step=\{600\}/);
});
