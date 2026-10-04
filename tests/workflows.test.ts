import { describe, expect, it } from "vitest";
import {
  defaultReachability,
  canReach,
  shouldAlert,
  resolveDepartmentRoute,
  validateReachability,
  type Reachability,
} from "../src/domain/workflows";
import { makeFixtures } from "../src/data/fixtures";
import { createMockService, coverage } from "../src/data/care-service";
import { createLocalWorkflow } from "../src/data/workflow-service";
import type { TeamMember, Snapshot } from "../src/domain/types";
const at = "2026-10-04T23:00:00Z";
const quiet: Reachability = {
  ...defaultReachability("a"),
  quietStart: 1320,
  quietEnd: 420,
};
describe("department routing and reachability", () => {
  it("handles overnight quiet hours and boundaries, and separates message delivery from alerts", () => {
    expect(canReach(quiet, "Routine", at)).toBe(false);
    expect(canReach(quiet, "Routine", "2026-10-05T07:00:00Z")).toBe(true);
    expect(canReach({ ...quiet, availability: "busy" }, "Urgent", at)).toBe(
      true,
    );
    expect(canReach({ ...quiet, availability: "offline" }, "Urgent", at)).toBe(
      false,
    );
    expect(shouldAlert({ ...quiet, alerts: "urgent" }, "Routine", at)).toBe(
      false,
    );
    expect(shouldAlert(quiet, "Urgent", at)).toBe(true);
    expect(shouldAlert({ ...quiet, alerts: "none" }, "Urgent", at)).toBe(false);
  });
  it("keeps every department continuously staffed while preserving primary coverage", () => {
    const data = makeFixtures();
    expect(data.shifts).toHaveLength(378);
    expect(
      coverage(data.shifts, "2026-10-04T07:00:00Z").current?.memberId,
    ).toBe("willow-test");
    for (const department of [
      "medicine",
      "nursing",
      "pharmacy",
      "cardiology",
      "coordination",
    ]) {
      const shifts = data.shifts.filter((s) => s.department === department);
      expect(shifts).toHaveLength(63);
      for (let i = 1; i < shifts.length; i++)
        expect(shifts[i].start).toBe(shifts[i - 1].end);
    }
  });
  it("uses a reachable backup, excludes the sender, and never routes urgent traffic to Offline", () => {
    const data = makeFixtures();
    const now = "2026-10-04T12:00:00Z";
    const route = resolveDepartmentRoute(
      data.team,
      data.shifts,
      {},
      "coordination",
      "Routine",
      now,
      "outsider",
    );
    expect(route.recipient?.id).toBe("willow-test");
    const prefs = {
      "willow-test": {
        ...defaultReachability("willow-test"),
        availability: "offline" as const,
        backupId: "cedar-test",
      },
    };
    expect(
      resolveDepartmentRoute(
        data.team,
        data.shifts,
        prefs,
        "coordination",
        "Urgent",
        now,
        "outsider",
      ).recipient?.id,
    ).toBe("cedar-test");
    expect(
      resolveDepartmentRoute(
        data.team,
        data.shifts,
        prefs,
        "coordination",
        "Urgent",
        now,
        "cedar-test",
      ).recipient,
    ).toBeUndefined();
    expect(
      resolveDepartmentRoute(
        data.team,
        [],
        {},
        "coordination",
        "Routine",
        now,
        "outsider",
      ).recipient,
    ).toBeUndefined();
  });
  it("validates paired quiet-hour fields and permits daytime windows", () => {
    expect(() => validateReachability({ ...quiet, quietEnd: null })).toThrow();
    expect(() => validateReachability({ ...quiet, quietEnd: 1320 })).toThrow();
    expect(() =>
      validateReachability({ ...quiet, quietStart: 1439, quietEnd: 420 }),
    ).not.toThrow();
  });
});
describe("persistent handoffs", () => {
  it("saves selected snapshots once, restricts acceptance, and preserves the first acknowledgment", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => values.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        values.set(k, v);
      },
    };
    const people: TeamMember[] = [
      {
        id: "a",
        name: "Sender",
        role: "Team member",
        specialty: "Care coordination",
        initials: "AA",
        color: "#eee",
      },
      {
        id: "b",
        name: "Recipient",
        role: "Team member",
        specialty: "Care coordination",
        initials: "BB",
        color: "#eee",
      },
    ];
    const data: Snapshot = { ...makeFixtures(), team: people };
    const care = createMockService({ initial: data, delay: 0 });
    const create = (user: string) =>
      createLocalWorkflow(
        storage,
        user,
        () => ({ data, send: care.send }),
        () => at,
      );
    const a = create("a"),
      b = create("b"),
      c = create("c");
    const draft = {
      recipientId: "b",
      department: "coordination" as const,
      note: "Please follow up on the huddle.",
      conversationIds: [data.messages[0].id],
    };
    await a.share(draft, "same-key");
    await a.share(draft, "same-key");
    const [h] = (await a.load()).handoffs;
    expect((await a.load()).handoffs).toHaveLength(1);
    expect((await c.load()).handoffs).toEqual([]);
    expect(h.items[0].subject).toBe(data.messages[0].subject);
    data.messages[0].subject = "Changed after sharing";
    expect((await a.load()).handoffs[0].items[0].subject).not.toBe(
      "Changed after sharing",
    );
    await expect(a.accept(h.id)).rejects.toThrow("incoming");
    await expect(c.accept(h.id)).rejects.toThrow("incoming");
    await b.accept(h.id);
    await b.accept(h.id);
    const accepted = (await create("a").load()).handoffs[0];
    expect(accepted.acceptedAt).toBe(at);
    expect(accepted.acceptedBy).toBe("b");
    expect(accepted.status).toBe("Accepted");
    await expect(a.cancel(h.id)).rejects.toThrow("accepted");
  });
});
