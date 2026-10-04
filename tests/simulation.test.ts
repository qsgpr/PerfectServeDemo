import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLOCK_PRESETS,
  nextClockIndex,
  SimulationRunner,
  tourStep,
} from "../src/features/presentation/simulation";
import { createMockService, coverage } from "../src/data/care-service";
import { makeFixtures } from "../src/data/fixtures";
import { parsePreferences } from "../src/theme/preferences-model";
afterEach(() => vi.useRealTimers());
describe("demo clock and preferences", () => {
  it("cycles coverage at exact handoff boundaries", () => {
    const { shifts } = makeFixtures();
    expect(
      CLOCK_PRESETS.map((p) => coverage(shifts, p.at).current?.memberId),
    ).toEqual(["mira", "ellis", "noa"]);
    expect(nextClockIndex(2)).toBe(0);
  });
  it("restores only valid preferences and tolerates corrupted storage", () => {
    expect(parsePreferences("{bad")).toEqual(parsePreferences(null));
    expect(
      parsePreferences(
        '{"mode":"dark","autoReply":true,"haptics":"bad","password":"ignored"}',
      ),
    ).toEqual({
      mode: "dark",
      autoReply: true,
      haptics: true,
      reduceMotion: false,
    });
    expect(parsePreferences("null").mode).toBe("system");
  });
  it("labels each guided stage", () => {
    expect([0, 8, 16, 38, 46, 60].map(tourStep)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("1 of 5"),
        expect.stringContaining("2 of 5"),
        expect.stringContaining("3 of 5"),
        expect.stringContaining("4 of 5"),
        expect.stringContaining("5 of 5"),
        expect.stringContaining("complete"),
      ]),
    );
  });
});
describe("cancellable simulator", () => {
  it("plays read, typing, reply in order", async () => {
    vi.useFakeTimers();
    const act = vi.fn().mockResolvedValue(undefined);
    const emit = vi.fn();
    const runner = new SimulationRunner(act, emit);
    runner.start("one", "reply");
    await vi.advanceTimersByTimeAsync(2000);
    expect(act.mock.calls[0].slice(0, 2)).toEqual(["one", "read"]);
    await vi.advanceTimersByTimeAsync(1500);
    expect(emit).toHaveBeenLastCalledWith("one", { phase: "typing" });
    await vi.advanceTimersByTimeAsync(3000);
    expect(act.mock.calls[1].slice(0, 2)).toEqual(["one", "reply"]);
    expect(emit).toHaveBeenLastCalledWith("one", { phase: "replied" });
  });
  it("counts down once and cancels escalation when replaced by a reply", async () => {
    vi.useFakeTimers();
    const act = vi.fn().mockResolvedValue(undefined);
    const emit = vi.fn();
    const runner = new SimulationRunner(act, emit);
    runner.start("one", "escalation");
    await vi.advanceTimersByTimeAsync(5000);
    expect(emit).toHaveBeenLastCalledWith("one", {
      phase: "countdown",
      remaining: 10,
    });
    runner.start("one", "reply");
    await vi.advanceTimersByTimeAsync(20000);
    expect(act.mock.calls.map((c) => c[1])).toEqual(["read", "reply"]);
    runner.start("two", "escalation");
    await vi.advanceTimersByTimeAsync(16000);
    expect(act.mock.calls.filter((c) => c[1] === "escalate")).toHaveLength(1);
  });
  it("stops every timer on cleanup and surfaces service errors", async () => {
    vi.useFakeTimers();
    const act = vi.fn().mockRejectedValue(new Error("Demo failure"));
    const emit = vi.fn();
    const runner = new SimulationRunner(act, emit);
    runner.start("one", "reply");
    runner.start("two", "escalation");
    runner.stopAll();
    await vi.advanceTimersByTimeAsync(30000);
    expect(act).not.toHaveBeenCalled();
    runner.start("one", "reply");
    await vi.advanceTimersByTimeAsync(2500);
    expect(emit).toHaveBeenLastCalledWith("one", {
      phase: "error",
      error: "Demo failure",
    });
  });
  it("aborts an in-flight service action before it changes the message", async () => {
    const service = createMockService({ delay: 5 });
    const controller = new AbortController();
    const pending = service.act("coverage", "reply", controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow("stopped");
    expect(
      (await service.load()).messages.find((m) => m.id === "coverage")?.status,
    ).toBe("Sent");
  });
  it("cancels an in-flight guided send without leaving a hidden message", async () => {
    const service = createMockService({ delay: 5 });
    const before = await service.load();
    const controller = new AbortController();
    const pending = service.send(
      {
        recipientId: "mira",
        subject: "Cancelled demo",
        body: "Fictional",
        priority: "Urgent",
      },
      "cancelled",
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toThrow("stopped");
    expect((await service.load()).messages).toEqual(before.messages);
  });
  it("keeps event timestamps ordered when the fictional clock moves back", async () => {
    const service = createMockService({
      delay: 0,
      now: () => "2026-09-01T10:00:00Z",
    });
    const message = await service.act("coverage", "read");
    expect(message.events[1].at > message.events[0].at).toBe(true);
  });
});
