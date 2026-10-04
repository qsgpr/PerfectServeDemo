import type { AIContext } from "./ai-context";
import { Message } from "../../domain/types";
import { chatEntries } from "../../domain/chat";
export const AI_HISTORY_LIMIT = 20;
export function aiHistory(message: Message): AIRequest["history"] {
  return chatEntries(message)
    .filter((entry) => entry.kind !== "call")
    .slice(-AI_HISTORY_LIMIT)
    .map((entry) => ({
      role: entry.sender === "you" ? "user" : "assistant",
      content:
        entry.kind === "image"
          ? (entry.attachmentId === "device-photo"
              ? "[Shared photo attachment, image not analyzed: "
              : "[Shared fictional illustration: ") +
            entry.attachmentId +
            "] " +
            entry.text
          : entry.text,
    }));
}
export interface AIRequest {
  clockIndex: number;
  context?: AIContext;
  history: { role: "user" | "assistant"; content: string }[];
}
export function aiRequest(
  message: Message,
  clockIndex: number,
  context?: AIContext,
): AIRequest {
  return {
    clockIndex,
    ...(context ? { context } : {}),
    history: aiHistory(message),
  };
}
export async function requestAI(
  base: string,
  body: AIRequest,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(base + "/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
