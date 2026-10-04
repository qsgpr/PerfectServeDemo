import { describe, it, expect } from "vitest";
import { cloudMessage, CloudConversation } from "../src/data/cloud-model";
const row: CloudConversation = {
  id: "thread",
  owner_id: "first",
  recipient_id: "second",
  created_at: "2026-10-04T10:00:00Z",
  updated_at: "2026-10-04T10:01:00Z",
  payload: {
    subject: "Coverage",
    body: "Hello",
    priority: "Routine",
    status: "Replied",
    events: [],
    chat: [
      {
        id: "one",
        kind: "text",
        text: "Hello",
        senderId: "first",
        at: "2026-10-04T10:00:00Z",
        status: "Read",
      },
      {
        id: "two",
        kind: "text",
        text: "Reply",
        senderId: "second",
        at: "2026-10-04T10:01:00Z",
        status: "Sent",
      },
    ],
  },
};
describe("shared conversation perspectives", () => {
  it("shows each account its own bubbles and the other participant", () => {
    const first = cloudMessage(row, "first");
    const second = cloudMessage(row, "second");
    expect(first.recipientId).toBe("second");
    expect(second.recipientId).toBe("first");
    expect(first.chat?.map((e) => e.sender)).toEqual(["you", "teammate"]);
    expect(second.chat?.map((e) => e.sender)).toEqual(["teammate", "you"]);
    expect(first.status).toBe("Replied");
    expect(second.status).toBe("Sent");
    expect(row.payload.chat[0].senderId).toBe("first");
  });
  it("keeps receipt and escalation states consistent after reload", () => {
    const read = structuredClone(row);
    read.payload.chat[1].status = "Read";
    expect(cloudMessage(read, "second").status).toBe("Read");
    read.payload.status = "Escalated";
    expect(cloudMessage(read, "first").status).toBe("Escalated");
    expect(cloudMessage(read, "second").status).toBe("Escalated");
  });
});
