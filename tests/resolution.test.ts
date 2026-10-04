import { expect, it } from "vitest";
import { createPersistentService } from "../src/data/local-service";
import { aiHistory } from "../src/features/assistant/ai-client";
import { canAct } from "../src/data/care-service";
it("persists an idempotent archive, rejects late writes, and starts with fresh AI history", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => values.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      values.set(k, v);
    },
  };
  const service = createPersistentService(
    storage,
    () => "2026-10-04T12:00:00Z",
  );
  const draft = {
    recipientId: "nova",
    subject: "Old question",
    body: "My old question",
    priority: "Routine" as const,
  };
  const sent = await service.send(draft, "old");
  await service.receive(sent.id, "Old answer", sent.chat![0].id);
  const resolved = await service.resolve(sent.id);
  expect(resolved.status).toBe("Replied");
  expect((await service.resolve(sent.id)).resolvedAt).toBe(resolved.resolvedAt);
  expect(canAct(resolved, "reply")).toBe(false);
  await expect(
    service.post(sent.id, { kind: "text", text: "Late" }, "late"),
  ).rejects.toThrow("resolved");
  await expect(
    service.receive(sent.id, "Late AI", sent.chat![0].id),
  ).rejects.toThrow("resolved");
  const restored = createPersistentService(
    storage,
    () => "2026-10-05T12:00:00Z",
  );
  expect(
    (await restored.load()).messages.find((m) => m.id === sent.id)?.resolvedAt,
  ).toBe(resolved.resolvedAt);
  const fresh = await restored.send(
    { ...draft, subject: "New question", body: "My new question" },
    "new",
  );
  expect(fresh.id).not.toBe(sent.id);
  expect(fresh.resolvedAt).toBeUndefined();
  expect(aiHistory(fresh)).toEqual([
    { role: "user", content: "My new question" },
  ]);
  expect(aiHistory(resolved)).toHaveLength(2);
});
