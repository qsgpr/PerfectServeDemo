import { describe, expect, it } from "vitest";
import {
  createPersistentService,
  MESSAGES_KEY,
  parseSavedMessages,
} from "../src/data/local-service";
const draft = {
  recipientId: "nova",
  subject: "Shift handoff",
  body: "Who is on call?",
  priority: "Routine" as const,
};
function storage() {
  const values = new Map<string, string>();
  return {
    values,
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
describe("persistent conversations", () => {
  it("restores history and statuses in a new service and preserves distinct IDs", async () => {
    const disk = storage();
    const now = () => "2026-10-01T10:00:00Z";
    const first = createPersistentService(disk, now);
    const sent = await first.send(draft, "one");
    await first.receive(sent.id, "Mira is on call.", sent.chat![0].id);
    const second = createPersistentService(disk, now);
    const restored = (await second.load()).messages.find(
      (m) => m.id === sent.id,
    )!;
    expect(restored.status).toBe("Replied");
    expect(restored.chat).toHaveLength(2);
    expect((await second.load()).team.some((m) => m.kind === "ai")).toBe(true);
    const next = await second.send({ ...draft, recipientId: "mira" }, "two");
    expect(next.id).not.toBe(sent.id);
    expect(new Set((await second.load()).messages.map((m) => m.id)).size).toBe(
      5,
    );
  });
  it("serializes overlapping writes so neither conversation disappears", async () => {
    const disk = storage();
    const service = createPersistentService(disk, () =>
      new Date().toISOString(),
    );
    await Promise.all([
      service.send(draft, "one"),
      service.send({ ...draft, recipientId: "mira" }, "two"),
    ]);
    expect(parseSavedMessages(disk.values.get(MESSAGES_KEY)!)).toHaveLength(5);
  });
  it("reports saving errors and retries without duplicate sends", async () => {
    const disk = storage();
    let failed = false;
    const service = createPersistentService(
      {
        ...disk,
        async setItem(key, value) {
          if (!failed) {
            failed = true;
            throw new Error("disk");
          }
          await disk.setItem(key, value);
        },
      },
      () => new Date().toISOString(),
    );
    await expect(service.send(draft, "same")).rejects.toThrow(
      "could not be saved",
    );
    await service.send(draft, "same");
    expect(parseSavedMessages(disk.values.get(MESSAGES_KEY)!)).toHaveLength(4);
  });
  it("rejects damaged caches without overwriting them", () => {
    expect(() => parseSavedMessages("{broken")).toThrow("restored");
    expect(() =>
      parseSavedMessages(JSON.stringify({ version: 2, messages: [] })),
    ).toThrow("restored");
    expect(() =>
      parseSavedMessages(
        JSON.stringify({ version: 1, messages: [{ id: "bad" }] }),
      ),
    ).toThrow("restored");
    expect(
      parseSavedMessages(JSON.stringify({ version: 1, messages: [] })),
    ).toEqual([]);
  });
});
