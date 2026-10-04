import { makeFixtures } from "./fixtures";
import {
  ChatInput,
  DemoAction,
  Message,
  MessageDraft,
  MessageStatus,
  Shift,
  Snapshot,
  TeamMember,
} from "../domain/types";
import { chatEntries, validateChat } from "../domain/chat";
export interface CareService {
  resolve(id: string): Promise<Message>;
  receive(
    id: string,
    text: string,
    replyTo: string,
    signal?: AbortSignal,
  ): Promise<Message>;
  post(
    messageId: string,
    input: ChatInput,
    requestId: string,
  ): Promise<Message>;
  load(): Promise<Snapshot>;
  send(
    draft: MessageDraft,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<Message>;
  act(
    messageId: string,
    action: DemoAction,
    signal?: AbortSignal,
  ): Promise<Message>;
}
export function searchTeam(team: TeamMember[], query: string) {
  const q = query.trim().toLowerCase();
  return team.filter((m) =>
    `${m.name} ${m.role} ${m.specialty}`.toLowerCase().includes(q),
  );
}
export function coverage(shifts: Shift[], now = new Date().toISOString()) {
  const sorted = shifts
    .filter((s) => !s.department)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const instant = Date.parse(now);
  return {
    current: sorted.find(
      (s) => Date.parse(s.start) <= instant && instant < Date.parse(s.end),
    ),
    next: sorted.find((s) => Date.parse(s.start) > instant),
  };
}
export function validateDraft(draft: MessageDraft, team: TeamMember[]) {
  if (!team.some((m) => m.id === draft.recipientId))
    return "Choose a recipient from your team.";
  if (!draft.subject.trim()) return "Add a subject.";
  if (!draft.body.trim()) return "Write a message.";
  if (draft.subject.trim().length > 100 || draft.body.trim().length > 2000)
    return "Use at most 100 subject characters and 2,000 message characters.";
  if (!["Routine", "Urgent"].includes(draft.priority))
    return "Choose Routine or Urgent priority.";
  return undefined;
}
export function canAct(message: Message, action: DemoAction) {
  if (message.resolvedAt) return false;
  if (action === "read") return message.status === "Sent";
  if (action === "reply") return message.status !== "Replied";
  return (
    message.priority === "Urgent" &&
    message.status !== "Replied" &&
    !message.events
      .slice(message.events.map((e) => e.type).lastIndexOf("Sent") + 1)
      .some((e) => e.type === "Escalated")
  );
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function createMockService(
  options: {
    delay?: number;
    initial?: Snapshot;
    failLoads?: number;
    now?: () => string;
  } = {},
): CareService {
  const data = clone(options.initial ?? makeFixtures());
  const requests = new Map<string, string>();
  const posts = new Set<string>();
  const replies = new Set<string>();
  data.messages.forEach((message) => {
    message.chat = chatEntries(message);
  });
  let sequence = Math.max(
    0,
    ...data.messages
      .flatMap((m) => [
        m.id,
        ...m.events.map((e) => e.id),
        ...(m.chat ?? []).map((e) => e.id),
      ])
      .map((id) => Number(id.match(/-(\d+)$/)?.[1] ?? 0)),
  );
  let failures = options.failLoads ?? 0;
  const pause = () =>
    new Promise<void>((resolve) => setTimeout(resolve, options.delay ?? 350));
  const now = options.now ?? (() => new Date().toISOString());
  const stamp = (message: Message) =>
    new Date(
      Math.max(
        new Date(now()).getTime(),
        new Date(
          message.updatedAt ?? message.events.at(-1)?.at ?? message.createdAt,
        ).getTime() + 1000,
      ),
    ).toISOString();
  return {
    async resolve(id) {
      await pause();
      const message = data.messages.find((m) => m.id === id);
      if (!message) throw new Error("Conversation not found.");
      if (!message.resolvedAt) {
        message.resolvedAt = stamp(message);
        message.resolvedBy = "demo-user";
        message.updatedAt = message.resolvedAt;
      }
      return clone(message);
    },
    async receive(id, text, replyTo, signal) {
      await pause();
      if (signal?.aborted) throw new Error("AI reply cancelled.");
      const message = data.messages.find((m) => m.id === id);
      if (!message) throw new Error("Conversation not found.");
      if (message.resolvedAt)
        throw new Error(
          "This conversation is resolved. Start a new conversation.",
        );
      if (replies.has(id + ":" + replyTo)) return clone(message);
      const last = chatEntries(message)
        .filter((e) => e.sender === "you" && e.kind !== "call")
        .at(-1);
      if (last?.id !== replyTo)
        throw new Error("A newer message is waiting for a reply.");
      if (!text.trim() || text.length > 4000)
        throw new Error("Invalid AI reply.");
      const at = stamp(message);
      const entryId = id + "-ai-" + ++sequence;
      message.chat ??= chatEntries(message);
      for (const entry of message.chat)
        if (entry.sender === "you" && entry.kind !== "call")
          entry.status = "Read";
      message.chat.push({
        id: entryId,
        kind: "text",
        sender: "teammate",
        text: text.trim(),
        at,
      });
      message.events.push({
        id: entryId,
        type: "Replied",
        at,
        text: text.trim(),
      });
      message.status = "Replied";
      message.updatedAt = at;
      replies.add(id + ":" + replyTo);
      return clone(message);
    },
    async post(id, input, requestId) {
      await pause();
      const message = data.messages.find((m) => m.id === id);
      if (!message) throw new Error("This conversation was not found.");
      if (message.resolvedAt)
        throw new Error(
          "This conversation is resolved. Start a new conversation.",
        );
      const key = id + ":" + requestId;
      if (posts.has(key)) return clone(message);
      const error = validateChat(input);
      if (error) throw new Error(error);
      const at = stamp(message);
      const entryId = id + "-chat-" + ++sequence;
      message.chat ??= chatEntries(message);
      message.chat.push({
        ...input,
        ...(input.kind !== "call"
          ? { text: input.text.trim(), status: "Sent" as const }
          : {}),
        id: entryId,
        sender: "you",
        at,
      });
      message.updatedAt = at;
      if (input.kind !== "call") {
        message.status = "Sent";
        message.events.push({
          id: entryId + "-sent",
          type: "Sent",
          at,
          text: "Message sent.",
        });
      }
      posts.add(key);
      return clone(message);
    },
    async load() {
      await pause();
      if (failures-- > 0)
        throw new Error("Your team data could not load. Please try again.");
      return clone(data);
    },
    async send(draft, requestId, signal) {
      await pause();
      if (signal?.aborted) throw new Error("Playback stopped.");
      const existing = requests.get(requestId);
      if (existing) return clone(data.messages.find((m) => m.id === existing)!);
      const error = validateDraft(draft, data.team);
      if (error) throw new Error(error);
      const at = now();
      const id = `local-${++sequence}`;
      const message: Message = {
        ...(draft.routing ? { routing: { ...draft.routing } } : {}),
        ...draft,
        subject: draft.subject.trim(),
        body: draft.body.trim(),
        id,
        status: "Sent",
        createdAt: at,
        events: [
          {
            id: `${id}-sent`,
            type: "Sent",
            at,
            text: "Message sent.",
          },
        ],
      };
      message.chat = chatEntries(message);
      requests.set(requestId, id);
      data.messages.unshift(message);
      return clone(message);
    },
    async act(id, action, signal) {
      await pause();
      if (signal?.aborted) throw new Error("Playback stopped.");
      const message = data.messages.find((m) => m.id === id);
      if (!message) throw new Error("This conversation was not found.");
      if (!canAct(message, action)) return clone(message);
      const status: MessageStatus =
        action === "read"
          ? "Read"
          : action === "reply"
            ? "Replied"
            : "Escalated";
      message.status = status;
      message.events.push({
        id: `${id}-${++sequence}`,
        type: status,
        at: stamp(message),
        text:
          action === "reply"
            ? "Thanks for the update. I’ll take a look before our team huddle."
            : action === "read"
              ? "Message read."
              : "Escalation sent to the backup team.",
      });
      const event = message.events.at(-1)!;
      message.updatedAt = event.at;
      message.chat ??= chatEntries(message);
      const outgoing = [...message.chat]
        .reverse()
        .find((entry) => entry.sender === "you" && entry.kind !== "call");
      if (outgoing) outgoing.status = action === "reply" ? "Read" : status;
      if (action === "reply") {
        for (const entry of message.chat) {
          if (
            entry.sender === "you" &&
            entry.kind !== "call" &&
            entry.status === "Sent"
          )
            entry.status = "Read";
        }
      }
      if (action === "reply")
        message.chat.push({
          id: event.id,
          kind: "text",
          sender: "teammate",
          at: event.at,
          text: event.text,
        });
      return clone(message);
    },
  };
}
export const mockService = createMockService();
