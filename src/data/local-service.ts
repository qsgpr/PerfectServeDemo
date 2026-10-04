import { createMockService, CareService } from "./care-service";
import { makeFixtures } from "./fixtures";
import { Message } from "../domain/types";
export interface LocalStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export const MESSAGES_KEY = "shiftline.messages.v1";
export const CLOCK_KEY = "shiftline.clock.v2";
export function parseSavedMessages(raw: string | null): Message[] {
  if (!raw) return makeFixtures().messages;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Saved conversations could not be restored.");
  }
  const team = new Set(makeFixtures().team.map((m) => m.id));
  const statuses = ["Sent", "Read", "Replied", "Escalated"];
  const validDate = (value: unknown) =>
    typeof value === "string" && Number.isFinite(Date.parse(value));
  if (
    parsed?.version !== 1 ||
    !Array.isArray(parsed.messages) ||
    parsed.messages.some(
      (m: Message) =>
        !m ||
        typeof m.id !== "string" ||
        !team.has(m.recipientId) ||
        typeof m.subject !== "string" ||
        typeof m.body !== "string" ||
        !["Routine", "Urgent"].includes(m.priority) ||
        !statuses.includes(m.status) ||
        !validDate(m.createdAt) ||
        !Array.isArray(m.events) ||
        m.events.some(
          (e) =>
            !e ||
            typeof e.id !== "string" ||
            !statuses.includes(e.type) ||
            !validDate(e.at) ||
            typeof e.text !== "string",
        ) ||
        (m.resolvedAt !== undefined &&
          (!validDate(m.resolvedAt) || typeof m.resolvedBy !== "string")) ||
        (m.updatedAt !== undefined && !validDate(m.updatedAt)) ||
        (m.chat !== undefined &&
          (!Array.isArray(m.chat) ||
            m.chat.some(
              (e) =>
                !e ||
                typeof e.id !== "string" ||
                !["you", "teammate"].includes(e.sender) ||
                !validDate(e.at) ||
                (e.kind === "text"
                  ? typeof e.text !== "string"
                  : e.kind === "image"
                    ? typeof e.text !== "string" ||
                      !["handoff-board", "team-map", "device-photo"].includes(
                        e.attachmentId,
                      )
                    : e.kind === "call"
                      ? !["voice", "video"].includes(e.mode) ||
                        !["completed", "cancelled"].includes(e.outcome) ||
                        !Number.isFinite(e.duration)
                      : true),
            ))),
    )
  )
    throw new Error("Saved conversations could not be restored.");
  const ids = parsed.messages.map((m: Message) => m.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Saved conversations could not be restored.");
  return parsed.messages;
}
/** Serialize mutations and durable writes; storage failures remain retryable. */
export function createPersistentService(
  storage: LocalStorage,
  now: () => string,
): CareService {
  let service: CareService | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const initialize = async () => {
    if (!service) {
      const messages = parseSavedMessages(await storage.getItem(MESSAGES_KEY));
      service = createMockService({
        initial: { ...makeFixtures(), messages },
        now,
      });
    }
    return service;
  };
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const mutate = (operation: (service: CareService) => Promise<Message>) =>
    enqueue(async () => {
      const ready = await initialize();
      const message = await operation(ready);
      const snapshot = await ready.load();
      try {
        await storage.setItem(
          MESSAGES_KEY,
          JSON.stringify({ version: 1, messages: snapshot.messages }),
        );
      } catch {
        throw new Error(
          "Your update could not be saved on this device. Please retry.",
        );
      }
      return message;
    });
  return {
    load: () => enqueue(async () => (await initialize()).load()),
    send: (...args) => mutate((service) => service.send(...args)),
    post: (...args) => mutate((service) => service.post(...args)),
    act: (...args) => mutate((service) => service.act(...args)),
    resolve: (...args) => mutate((service) => service.resolve(...args)),
    receive: (...args) => mutate((service) => service.receive(...args)),
  };
}
