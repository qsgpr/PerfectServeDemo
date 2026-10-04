import { memberSpace } from "../domain/chat";
import type { Shift } from "../domain/types";
import { DAY_MS } from "../domain/schedule";

// Rotate the full fictional human roster; Nova is an always-available AI, not on-call staff.
export const OCTOBER_ROSTER = [
  "ada",
  "mira",
  "ellis",
  "noa",
  "theo",
  "remy",
  "cedar-test",
  "willow-test",
];
export function makeOctoberSchedule(
  roster: readonly string[] = OCTOBER_ROSTER,
): Shift[] {
  if (!roster.length) return [];
  const first = Date.parse("2026-10-01T07:00:00Z");
  const halfDay = DAY_MS / 2;
  // Include the previous night's shift so October 1 has coverage from midnight.
  return Array.from({ length: 63 }, (_, index) => {
    const start = first + (index - 1) * halfDay;
    return {
      id: `october-2026-${index}`,
      memberId: roster[index % roster.length],
      start: new Date(start).toISOString(),
      end: new Date(start + halfDay).toISOString(),
    };
  });
}

export function makeDepartmentSchedule(
  team: import("../domain/types").TeamMember[],
): Shift[] {
  const departments = [
    "medicine",
    "nursing",
    "pharmacy",
    "cardiology",
    "coordination",
  ];
  return departments.flatMap((department) => {
    const roster = team
      .filter((m) => m.kind !== "ai" && memberSpace(m) === department)
      .map((m) => m.id)
      .sort();
    return makeOctoberSchedule(roster).map((s) => ({
      ...s,
      id: department + "-" + s.id,
      department,
    }));
  });
}
