import { describe, expect, it } from "vitest";
import { createMockService, canAct } from "../src/data/care-service";
import { chatEntries, chatPreview } from "../src/domain/chat";
describe("chat thread service", () => {
  it("keeps both sides of seeded and ongoing conversations and deduplicates follow-ups", async () => {
    const service = createMockService({ delay: 0 });
    const seeded = (await service.load()).messages.find(
      (m) => m.id === "welcome",
    )!;
    expect(chatEntries(seeded).map((e) => e.sender)).toEqual([
      "you",
      "teammate",
    ]);
    const [a, b] = await Promise.all([
      service.post(
        "welcome",
        { kind: "text", text: "  Coverage confirmed. " },
        "one",
      ),
      service.post(
        "welcome",
        { kind: "text", text: "Coverage confirmed." },
        "one",
      ),
    ]);
    expect(a.chat).toHaveLength(3);
    expect(b.chat).toEqual(a.chat);
    expect(a.status).toBe("Sent");
    const replied = await service.act("welcome", "reply");
    expect(replied.chat).toHaveLength(4);
    expect(replied.chat?.at(-1)?.sender).toBe("teammate");
    expect(replied.chat?.[2].status).toBe("Read");
    expect((await service.act("welcome", "reply")).chat).toHaveLength(4);
    expect(chatPreview(replied)).toContain("Thanks");
  });
  it("shares only known images, isolates snapshots, and records calls without resetting delivery", async () => {
    const service = createMockService({ delay: 0 });
    const image = await service.post(
      "welcome",
      { kind: "image", attachmentId: "handoff-board", text: "" },
      "image",
    );
    expect(chatPreview(image)).toBe("Shared an image");
    const call = await service.post(
      "welcome",
      { kind: "call", mode: "video", duration: 42, outcome: "completed" },
      "call",
    );
    expect(call.status).toBe("Sent");
    expect(chatPreview(call)).toBe("Video call · 00:42");
    expect(
      (
        await service.post(
          "welcome",
          { kind: "call", mode: "video", duration: 42, outcome: "completed" },
          "call",
        )
      ).chat,
    ).toHaveLength(4);
    call.chat!.length = 0;
    expect(
      (await service.load()).messages.find((m) => m.id === "welcome")?.chat,
    ).toHaveLength(4);
    await expect(
      service.post("welcome", { kind: "text", text: "  " }, "blank"),
    ).rejects.toThrow("Write");
    await expect(
      service.post(
        "welcome",
        { kind: "call", mode: "voice", duration: -1, outcome: "completed" },
        "bad",
      ),
    ).rejects.toThrow("call");
    await expect(
      service.post("missing", { kind: "text", text: "Hi" }, "missing"),
    ).rejects.toThrow("not found");
  });
  it("requires a stored path for device photos and deduplicates photo sends", async () => {
    const service = createMockService({ delay: 0 });
    await expect(
      service.post(
        "welcome",
        { kind: "image", attachmentId: "device-photo", text: "" },
        "missing-photo",
      ),
    ).rejects.toThrow("Choose a photo");
    const input = {
      kind: "image" as const,
      attachmentId: "device-photo" as const,
      text: "Fictional room",
      imagePath: "welcome/fictional-user/test.png",
    };
    const first = await service.post("welcome", input, "photo");
    const retry = await service.post("welcome", input, "photo");
    expect(retry.chat).toEqual(first.chat);
    expect(retry.chat?.at(-1)).toMatchObject({ imagePath: input.imagePath });
  });
  it("starts a fresh escalation cycle only when a new outgoing message is sent", async () => {
    const service = createMockService({
      delay: 0,
      now: () => "2026-09-01T10:00:00Z",
    });
    await service.act("coverage", "escalate");
    await service.act("coverage", "reply");
    const followup = await service.post(
      "coverage",
      { kind: "text", text: "One more team update." },
      "followup",
    );
    expect(canAct(followup, "escalate")).toBe(true);
    const escalated = await service.act("coverage", "escalate");
    expect(escalated.events.filter((e) => e.type === "Escalated")).toHaveLength(
      2,
    );
    expect(canAct(escalated, "escalate")).toBe(false);
    expect(escalated.chat!.at(-1)!.at > escalated.chat![0].at).toBe(true);
  });
});
