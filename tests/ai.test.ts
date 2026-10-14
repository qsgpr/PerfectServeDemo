import { afterEach, describe, expect, it, vi } from "vitest";
import { aiRequest, requestAI } from "../src/features/assistant/ai-client";
import { createMockService } from "../src/data/care-service";
const draft = {
  recipientId: "nova",
  subject: "Team handoff",
  body: "Who is on call?",
  priority: "Routine" as const,
};
afterEach(() => vi.unstubAllGlobals());
describe("AI conversation", () => {
  it("appends one reply, updates status, and ignores a repeated reply", async () => {
    const service = createMockService({ delay: 0 });
    const sent = await service.send(draft, "one");
    const id = sent.chat![0].id;
    const reply = await service.receive(sent.id, "Mira is on call.", id);
    expect(reply.status).toBe("Replied");
    expect(reply.chat![0].status).toBe("Read");
    expect(reply.chat!.at(-1)?.sender).toBe("teammate");
    expect((await service.receive(sent.id, "Duplicate", id)).chat).toHaveLength(
      2,
    );
    const followup = await service.post(
      sent.id,
      { kind: "text", text: "Who takes over?" },
      "two",
    );
    expect(followup.status).toBe("Sent");
    expect(aiRequest(followup, 1)).toEqual({
      clockIndex: 1,
      history: [
        { role: "user", content: "Who is on call?" },
        { role: "assistant", content: "Mira is on call." },
        { role: "user", content: "Who takes over?" },
      ],
    });
  });
  it("rejects a stale or aborted reply without mutating the thread", async () => {
    const service = createMockService({ delay: 0 });
    const sent = await service.send(draft, "one");
    const updated = await service.post(
      sent.id,
      { kind: "text", text: "Actually, evening coverage?" },
      "two",
    );
    await expect(
      service.receive(sent.id, "Old reply", sent.chat![0].id),
    ).rejects.toThrow("newer message");
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.receive(
        sent.id,
        "Cancelled",
        updated.chat!.at(-1)!.id,
        controller.signal,
      ),
    ).rejects.toThrow("cancelled");
    expect((await service.load()).messages[0].status).toBe("Sent");
    expect((await service.load()).messages[0].chat).toHaveLength(2);
  });
  it("caps context and includes references to supplied images", async () => {
    const service = createMockService({ delay: 0 });
    let message = await service.send(draft, "one");
    for (let i = 0; i < 22; i++)
      message = await service.post(
        message.id,
        { kind: "text", text: "Update " + i },
        String(i),
      );
    message = await service.post(
      message.id,
      { kind: "image", attachmentId: "handoff-board", text: "Our board" },
      "image",
    );
    expect(aiRequest(message, 0).history).toHaveLength(20);
    expect(aiRequest(message, 0).conversationId).toBe(message.id);
    expect(aiRequest(message, 0).history.at(-1)?.image).toEqual({
      attachmentId: "handoff-board",
      entryId: message.chat!.at(-1)!.id,
    });
    expect(aiRequest(message, 0).history.at(-1)?.content).toContain(
      "Shared fictional illustration",
    );
  });
  it("surfaces backend errors and forwards cancellation without any provider credential", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "No available quota." }),
    });
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    await expect(
      requestAI(
        "http://server:8082",
        { clockIndex: 0, history: [{ role: "user", content: "Hi" }] },
        controller.signal,
      ),
    ).rejects.toThrow("No available quota.");
    expect(fetcher.mock.calls[0][1].signal).toBe(controller.signal);
    expect(fetcher.mock.calls[0][1].headers).toEqual({
      "Content-Type": "application/json",
    });
  });
});

it("keeps only the last three user image references and excludes images from AI replies", async () => {
  const service = createMockService({ delay: 0 });
  let message = await service.send(draft, "image-window");
  for (let index = 0; index < 5; index++)
    message = await service.post(
      message.id,
      { kind: "image", attachmentId: "handoff-board", text: "Board " + index },
      "window-" + index,
    );
  const request = aiRequest(message, 0);
  expect(request.history.filter((entry) => entry.image)).toHaveLength(3);
  expect(
    request.history
      .filter((entry) => entry.image)
      .map((entry) => entry.content),
  ).toEqual(
    [2, 3, 4].map(
      (index) =>
        "[Shared fictional illustration: handoff-board] Board " + index,
    ),
  );
});
