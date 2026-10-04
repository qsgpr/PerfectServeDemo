import { ChatEntry, ChatInput, Message, TeamMember } from "../domain/types";
export interface CloudConversation {
  id: string;
  owner_id: string;
  recipient_id: string;
  created_at: string;
  updated_at: string;
  payload: Omit<
    Message,
    "id" | "recipientId" | "createdAt" | "updatedAt" | "chat"
  > & {
    chat: (ChatInput & {
      id: string;
      at: string;
      status?: Message["status"];
      senderId: string;
    })[];
  };
}
/** Sender identity is persisted once; left/right placement is derived for each viewer. */
export function cloudMessage(row: CloudConversation, userId: string): Message {
  const { payload, ...record } = row;
  const last = payload.chat.filter((entry) => entry.kind !== "call").at(-1);
  const status =
    payload.status === "Escalated"
      ? "Escalated"
      : last?.senderId === userId
        ? (last.status ?? "Sent")
        : "Replied";
  return {
    ...payload,
    status,
    id: record.id,
    recipientId:
      record.owner_id === userId ? record.recipient_id : record.owner_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    chat: payload.chat.map(
      ({ senderId, ...entry }) =>
        ({
          ...entry,
          sender: senderId === userId ? "you" : "teammate",
        }) as ChatEntry,
    ),
  };
}
export function isRegisteredMember(member?: TeamMember) {
  return !!member?.userId;
}
