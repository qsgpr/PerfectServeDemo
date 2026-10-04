import { describe, expect, it } from "vitest";
import { buildAIContext } from "../src/features/assistant/ai-context";
import { aiRequest } from "../src/features/assistant/ai-client";
import type { Snapshot } from "../src/domain/types";
const data: Snapshot = {
  team: [
    {
      id: "a",
      userId: "account-a",
      name: "Cedar Test",
      role: "Coordinator",
      specialty: "Care coordination",
      department: "coordination",
      initials: "CT",
      color: "green",
    },
    {
      id: "b",
      userId: "account-b",
      name: "Cedar Test",
      role: "Nurse",
      specialty: "Nursing",
      department: "nursing",
      initials: "CT",
      color: "blue",
    },
  ],
  shifts: [
    {
      id: "past",
      memberId: "a",
      start: "2026-10-03T07:00:00Z",
      end: "2026-10-03T19:00:00Z",
    },
    {
      id: "current",
      memberId: "a",
      department: "coordination",
      start: "2026-10-04T07:00:00Z",
      end: "2026-10-04T19:00:00Z",
    },
    {
      id: "next",
      memberId: "b",
      department: "coordination",
      start: "2026-10-04T19:00:00Z",
      end: "2026-10-05T07:00:00Z",
    },
  ],
  messages: [
    {
      id: "private",
      recipientId: "b",
      body: "Unrelated private text",
      subject: "Secret",
      priority: "Routine",
      status: "Sent",
      createdAt: "2026-10-04T10:00:00Z",
      events: [],
    },
  ],
};
const now = "2026-10-04T12:00:00Z";
describe("Nova account context", () => {
  it("matches the authenticated ID, includes only its shifts and excludes unrelated private data", () => {
    const context = buildAIContext(
      { id: "account-a", name: "Old display name" },
      data,
      now,
    )!;
    expect(context.viewer).toEqual({
      name: "Cedar Test",
      role: "Coordinator",
      specialty: "Care coordination",
      department: "coordination",
    });
    expect(context.myShifts.map((s) => s.start)).toEqual([
      data.shifts[0].start,
      data.shifts[1].start,
    ]);
    expect(
      context.coverage.find((c) => c.department === "coordination")?.current
        ?.start,
    ).toBe(data.shifts[1].start);
    expect(JSON.stringify(context)).not.toMatch(
      /Unrelated private|Secret|account-a|account-b/,
    );
    expect(
      buildAIContext({ id: "account-b", name: "Cedar Test" }, data, now)?.viewer
        .role,
    ).toBe("Nurse");
  });
  it("uses exact live handoff boundaries and does not infer a local user's role or shifts", () => {
    const context = buildAIContext(
      { id: "account-a", name: "Cedar Test" },
      data,
      "2026-10-04T19:00:00Z",
    )!;
    expect(
      context.coverage.find((c) => c.department === "coordination")?.current
        ?.start,
    ).toBe(data.shifts[2].start);
    const local = buildAIContext(
      { id: "demo-user", name: "Alex Morgan" },
      data,
      now,
    )!;
    expect(local.viewer.name).toBe("Alex Morgan");
    expect(local.viewer.role).toBeNull();
    expect(local.myShifts).toEqual([]);
    expect(buildAIContext(null, data, now)).toBeUndefined();
  });
  it("caps context, sorts assignments and reports truncation", () => {
    const large = {
      ...data,
      shifts: Array.from({ length: 129 }, (_, i) => ({
        ...data.shifts[0],
        id: String(i),
      })),
    };
    const context = buildAIContext(
      { id: "account-a", name: "Cedar Test" },
      large,
      now,
    )!;
    expect(context.myShifts).toHaveLength(128);
    expect(context.myShiftsTruncated).toBe(true);
    expect(
      buildAIContext({ id: "account-a", name: "Cedar Test" }, null, now)
        ?.scheduleRange,
    ).toBeNull();
    expect(aiRequest(data.messages[0], 0, context).context).toBe(context);
  });
});
