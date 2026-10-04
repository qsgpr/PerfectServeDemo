import type { Shift } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const utcDay = (date: string | Date) =>
  new Date(date).toISOString().slice(0, 10);
export const monthOf = (day: string) => day.slice(0, 7);
export function moveMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}
export function monthCells(month: string): (string | null)[] {
  const first = new Date(month + "-01T00:00:00Z");
  const last = new Date(moveMonth(month, 1) + "-01T00:00:00Z");
  const days = (last.getTime() - first.getTime()) / DAY_MS;
  // Monday is the first column; pad both ends to keep complete calendar rows.
  const before = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(before).fill(null);
  for (let day = 0; day < days; day++)
    cells.push(utcDay(new Date(first.getTime() + day * DAY_MS)));
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function shiftsForDay(shifts: Shift[], day: string) {
  const start = new Date(day + "T00:00:00Z").getTime();
  const end = start + DAY_MS;
  return shifts
    .filter(
      (shift) => Date.parse(shift.start) < end && Date.parse(shift.end) > start,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}
export function dayLabel(day: string) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function monthLabel(month: string) {
  return new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
