import { describe, expect, it } from "vitest";
import { makeFixtures } from "../src/data/fixtures";
import {
  canAct,
  coverage,
  createMockService,
  searchTeam,
  validateDraft,
} from "../src/data/care-service";
const draft = {
  recipientId: "mira",
  subject: "Practice huddle",
  body: "Fictional training update.",
  priority: "Urgent" as const,
};
describe("local care service", () => {
  it("searches names, roles, and specialties without case sensitivity", () => {
    const { team } = makeFixtures();
    expect(searchTeam(team, " MIRA ")[0].id).toBe("mira");
    expect(searchTeam(team, "PHARMACIST")[0].id).toBe("theo");
    expect(searchTeam(team, "cardiology")[0].id).toBe("noa");
    expect(searchTeam(team, "not a member")).toEqual([]);
  });
  it("selects the new provider exactly at handoff and handles empty schedules", () => {
    const { shifts } = makeFixtures();
    expect(coverage(shifts, "2026-10-01T10:00:00Z").current?.memberId).toBe(
      "mira",
    );
    expect(coverage(shifts, "2026-10-01T19:00:00Z").current?.memberId).toBe(
      "ellis",
    );
    expect(coverage([])).toEqual({ current: undefined, next: undefined });
  });
  it("rejects invalid recipients, blank fields, and excessive lengths", async () => {
    const service = createMockService({ delay: 0 });
    for (const invalid of [
      { ...draft, recipientId: "unknown" },
      { ...draft, subject: "  " },
      { ...draft, body: "\n " },
      { ...draft, body: "x".repeat(2001) },
    ]) {
      expect(validateDraft(invalid, makeFixtures().team)).toBeTruthy();
      await expect(service.send(invalid, "invalid")).rejects.toThrow();
    }
    expect((await service.load()).messages).toHaveLength(3);
  });
  it("deduplicates concurrent sends and isolates returned values", async () => {
    const service = createMockService({ delay: 0 });
    const [a, b] = await Promise.all([
      service.send({ ...draft, subject: "  Workshop  " }, "same"),
      service.send(draft, "same"),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.subject).toBe("Workshop");
    a.events.length = 0;
    const snapshot = await service.load();
    expect(snapshot.messages).toHaveLength(4);
    expect(snapshot.messages[0].events).toHaveLength(1);
  });
  it("keeps actions idempotent and reply terminal", async () => {
    const service = createMockService({ delay: 0 });
    const m = await service.send(draft, "one");
    await Promise.all([service.act(m.id, "read"), service.act(m.id, "read")]);
    const escalated = await service.act(m.id, "escalate");
    expect(escalated.status).toBe("Escalated");
    expect((await service.act(m.id, "read")).status).toBe("Escalated");
    await service.act(m.id, "escalate");
    const replied = await service.act(m.id, "reply");
    expect(replied.events.map((e) => e.type)).toEqual([
      "Sent",
      "Read",
      "Escalated",
      "Replied",
    ]);
    expect((await service.act(m.id, "escalate")).status).toBe("Replied");
    expect((await service.act(m.id, "reply")).events).toHaveLength(4);
  });
  it("does not escalate routine messages", async () => {
    const service = createMockService({ delay: 0 });
    const m = await service.send({ ...draft, priority: "Routine" }, "one");
    expect(canAct(m, "escalate")).toBe(false);
    expect((await service.act(m.id, "escalate")).status).toBe("Sent");
  });
  it("supports retrying a load failure, empty datasets, and missing-message errors", async () => {
    const service = createMockService({
      delay: 0,
      failLoads: 1,
      initial: { team: [], shifts: [], messages: [] },
    });
    await expect(service.load()).rejects.toThrow("could not load");
    expect(await service.load()).toEqual({
      team: [],
      shifts: [],
      messages: [],
    });
    await expect(service.act("missing", "reply")).rejects.toThrow("not found");
  });
});
