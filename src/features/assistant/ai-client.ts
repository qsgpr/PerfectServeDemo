import type { AIContext } from "./ai-context";
import { AttachmentId, Message } from "../../domain/types";
import { chatEntries } from "../../domain/chat";
export const AI_HISTORY_LIMIT = 20;
export function aiHistory(message: Message): AIRequest["history"] {
  const entries = chatEntries(message)
    .filter((entry) => entry.kind !== "call")
    .slice(-AI_HISTORY_LIMIT);
  const imageIds = new Set(
    entries
      .filter((entry) => entry.kind === "image" && entry.sender === "you")
      .slice(-3)
      .map((entry) => entry.id),
  );
  return entries.map((entry) => ({
    role: entry.sender === "you" ? "user" : "assistant",
    content:
      entry.kind === "image"
        ? (entry.attachmentId === "device-photo"
            ? "[Shared photo attachment: "
            : "[Shared fictional illustration: ") +
          entry.attachmentId +
          "] " +
          entry.text
        : entry.text,
    ...(entry.kind === "image" && imageIds.has(entry.id)
      ? {
          image: {
            attachmentId: entry.attachmentId,
            entryId: entry.id,
            ...(entry.imagePath ? { imagePath: entry.imagePath } : {}),
          },
        }
      : {}),
  }));
}
export interface AIRequest {
  clockIndex: number;
  conversationId?: string;
  context?: AIContext;
  history: {
    role: "user" | "assistant";
    content: string;
    image?: { attachmentId: AttachmentId; entryId: string; imagePath?: string };
  }[];
}
export function aiRequest(
  message: Message,
  clockIndex: number,
  context?: AIContext,
): AIRequest {
  return {
    clockIndex,
    ...(aiHistory(message).some((entry) => entry.image)
      ? { conversationId: message.id }
      : {}),
    ...(context ? { context } : {}),
    history: aiHistory(message),
  };
}
export async function requestAI(
  base: string,
  body: AIRequest,
  signal: AbortSignal,
  token?: string,
): Promise<string> {
  const response = await fetch(base + "/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "AI could not reply. Please retry.",
    );
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("AI returned no reply. Please retry.");
  return result.text;
}
