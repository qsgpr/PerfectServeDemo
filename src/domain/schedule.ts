import type { Shift } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const utcDay = (date: string | Date) =>
  new Date(date).toISOString().slice(0, 10);
export const monthOf = (day: string) => day.slice(0, 7);
export function localDay(date: string | Date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function localShiftTime(date: string, timeZone?: string) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
}
export function hideCompletedShifts(shifts: Shift[], now: string) {
  return shifts.filter((shift) => Date.parse(shift.end) > Date.parse(now));
}
export type ShiftGroup = Shift & { departments: Shift["department"][] };
export function groupShiftsByMember(
  shifts: Shift[],
  combine = true,
): ShiftGroup[] {
  const groups = new Map<string, ShiftGroup>();
  for (const shift of shifts) {
    // Equal instants may arrive with different offsets or timestamp precision.
    const key = combine
      ? JSON.stringify([
          shift.memberId,
          Date.parse(shift.start),
          Date.parse(shift.end),
        ])
      : shift.id;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.departments.includes(shift.department))
        existing.departments.push(shift.department);
    } else {
      groups.set(key, { ...shift, departments: [shift.department] });
    }
  }
  return [...groups.values()];
}
export function localShiftsForDay(shifts: Shift[], day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const start = new Date(year, month - 1, date).getTime();
  // Construct the next local midnight to account for daylight-saving changes.
  const end = new Date(year, month - 1, date + 1).getTime();
  return shifts
    .filter(
      (shift) => Date.parse(shift.start) < end && Date.parse(shift.end) > start,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}
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
