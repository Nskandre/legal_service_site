export type BookingSlot = { date: string; time: string };

export function normalizeBookingSlots(value: unknown): BookingSlot[] {
  return Array.isArray(value)
    ? value
        .filter((slot): slot is BookingSlot => Boolean(
          slot &&
          typeof slot === "object" &&
          /^\d{4}-\d{2}-\d{2}$/.test((slot as BookingSlot).date) &&
          /^\d{2}:\d{2}$/.test((slot as BookingSlot).time),
        ))
        .slice(0, 180)
        .sort((left, right) =>
          (left.date + "T" + left.time).localeCompare(right.date + "T" + right.time))
    : [];
}

export function takeBookingSlot(value: unknown, date: string, time: string) {
  const slots = normalizeBookingSlots(value);
  if (!slots.some((slot) => slot.date === date && slot.time === time)) return null;
  return slots.filter((slot) => slot.date !== date || slot.time !== time);
}
