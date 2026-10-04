import { describe, expect, it } from "vitest";
import {
  OCTOBER_ROSTER,
  makeOctoberSchedule,
} from "../src/data/schedule-fixtures";
import { coverage } from "../src/data/care-service";
import { createAppClock, CLOCK_PRESETS } from "../src/domain/clock";
import { monthCells, moveMonth, shiftsForDay } from "../src/domain/schedule";

describe("monthly fictional coverage", () => {
  it("covers all October without gaps and changes providers exactly at handoff", () => {
    const shifts = makeOctoberSchedule();
    expect(shifts).toHaveLength(63);
    for (let index = 1; index < shifts.length; index++)
      expect(shifts[index].start).toBe(shifts[index - 1].end);
    expect(coverage(shifts, "2026-10-01T00:00:00Z").current?.memberId).toBe(
      "ada",
    );
    expect(coverage(shifts, "2026-10-04T06:59:59Z").current?.memberId).toBe(
      "cedar-test",
    );
    expect(coverage(shifts, "2026-10-04T07:00:00Z").current?.memberId).toBe(
      "willow-test",
    );
    expect(coverage(shifts, "2026-10-31T23:59:59Z").current?.memberId).toBe(
      "cedar-test",
    );
  });
  it("rotates all eight human teammates fairly, including both test profiles", () => {
    const shifts = makeOctoberSchedule();
    const counts = OCTOBER_ROSTER.map(
      (id) => shifts.filter((s) => s.memberId === id).length,
    );
    expect(new Set(shifts.map((s) => s.memberId))).toEqual(
      new Set(OCTOBER_ROSTER),
    );
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(makeOctoberSchedule([])).toEqual([]);
    expect(
      makeOctoberSchedule(["new-person"]).every(
        (s) => s.memberId === "new-person",
      ),
    ).toBe(true);
  });
  it("compares instants consistently across offsets and timestamp precision", () => {
    const shifts = makeOctoberSchedule();
    const utc = coverage(shifts, "2026-10-04T07:00:00Z");
    expect(coverage(shifts, "2026-10-04T03:00:00-04:00")).toEqual(utc);
    expect(coverage(shifts, "2026-10-04T07:00:00.000Z")).toEqual(utc);
    expect(utc.current?.memberId).toBe("willow-test");
    expect(utc.next?.start).toBe("2026-10-04T19:00:00.000Z");
  });
  it("includes overnight carryover but excludes shifts ending at the day boundary", () => {
    const shifts = makeOctoberSchedule();
    const day = shiftsForDay(shifts, "2026-10-04");
    expect(day).toHaveLength(3);
    expect(day[0].start).toBe("2026-10-03T19:00:00.000Z");
    expect(day[2].end).toBe("2026-10-05T07:00:00.000Z");
    expect(
      shiftsForDay(
        [
          {
            id: "ending",
            memberId: "mira",
            start: "2026-10-03T12:00:00Z",
            end: "2026-10-04T00:00:00Z",
          },
        ],
        "2026-10-04",
      ),
    ).toEqual([]);
    expect(shiftsForDay(shifts, "2026-11-03")).toEqual([]);
  });
  it("creates complete Monday-first rows and navigates across year/leap-year boundaries", () => {
    const cells = monthCells("2026-10");
    expect(cells.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
    expect(monthCells("2028-02").filter(Boolean)).toHaveLength(29);
    expect(moveMonth("2026-12", 1)).toBe("2027-01");
    expect(moveMonth("2026-01", -1)).toBe("2025-12");
  });
  it("uses live time until an explicit simulation and resumes live time on reset", () => {
    let realTime = "2026-10-04T12:00:00Z";
    const clock = createAppClock(() => realTime);
    expect(clock.now()).toBe(realTime);
    realTime = "2026-10-04T19:00:00Z";
    expect(clock.now()).toBe(realTime);
    clock.set(1);
    expect(clock.now()).toBe(CLOCK_PRESETS[1].at);
    clock.set(-1);
    expect(clock.now()).toBe(realTime);
  });
});
