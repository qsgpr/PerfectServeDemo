import { ChatEntry, ChatInput, Message, TeamMember } from "./types";
export const TEAM_SPACES = [
  { id: "all", name: "All teams", icon: "grid" },
  { id: "coordination", name: "Care coordination", icon: "users" },
  { id: "assistant", name: "AI teammate", icon: "cpu" },
  { id: "medicine", name: "Medicine", icon: "activity" },
  { id: "nursing", name: "Nursing", icon: "heart" },
  { id: "pharmacy", name: "Pharmacy", icon: "package" },
  { id: "cardiology", name: "Cardiology", icon: "zap" },
] as const;
export type SpaceId = (typeof TEAM_SPACES)[number]["id"];
export function memberSpace(member?: TeamMember): SpaceId {
  if (TEAM_SPACES.some((s) => s.id === member?.department))
    return member!.department as SpaceId;
  if (member?.kind === "ai") return "assistant";
  if (member?.specialty === "Internal medicine") return "medicine";
  if (member?.specialty === "Cardiology") return "cardiology";
  if (member?.specialty === "Pharmacy") return "pharmacy";
  return /nurse/i.test(member?.role ?? "") ? "nursing" : "coordination";
}
export function chatEntries(message: Message): ChatEntry[] {
  return (
    message.chat ?? [
      {
        id: message.id + "-first",
        kind: "text",
        sender: "you",
        text: message.body,
        at: message.createdAt,
        status: message.status,
      },
      ...message.events
        .filter((e) => e.type === "Replied")
        .map((e) => ({
          id: e.id,
          kind: "text" as const,
          sender: "teammate" as const,
          text: e.text,
          at: e.at,
        })),
    ]
  );
}
export function validateChat(input: ChatInput): string | undefined {
  if (input.kind === "call") {
    if (
      !["voice", "video"].includes(input.mode) ||
      !["completed", "cancelled"].includes(input.outcome) ||
      !Number.isFinite(input.duration) ||
      input.duration < 0 ||
      input.duration > 86400
    )
      return "This call could not be saved.";
  } else {
    if (input.text.length > 2000) return "Use at most 2,000 characters.";
    if (input.kind === "text" && !input.text.trim()) return "Write a message.";
    if (
      input.kind === "image" &&
      !["handoff-board", "team-map", "device-photo"].includes(
        input.attachmentId,
      )
    )
      return "Choose an available image.";
    if (
      input.kind === "image" &&
      input.attachmentId === "device-photo" &&
      !input.imagePath
    )
      return "Choose a photo.";
  }
}
export function chatPreview(message: Message) {
  const last = chatEntries(message).at(-1);
  if (!last) return message.body;
  if (last.kind === "call")
    return (
      (last.mode === "voice" ? "Voice call" : "Video call") +
      (last.outcome === "cancelled"
        ? " · Cancelled"
        : " · " + formatDuration(last.duration))
    );
  if (last.kind === "image") return last.text || "Shared an image";
  return last.text;
}
export function formatDuration(seconds: number) {
  return (
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (seconds % 60).toString().padStart(2, "0")
  );
}
