export type Priority = "Routine" | "Urgent";
export type MessageStatus = "Sent" | "Read" | "Replied" | "Escalated";
export type Presence = "available" | "busy" | "in-call" | "offline";
export type DemoAction = "read" | "reply" | "escalate";
export interface TeamMember {
  department?: string;
  userId?: string;
  id: string;
  kind?: "person" | "ai";
  name: string;
  role: string;
  specialty: string;
  initials: string;
  color: string;
  presence?: Presence;
}
export interface Shift {
  department?: string;
  id: string;
  memberId: string;
  start: string;
  end: string;
}
export interface MessageEvent {
  id: string;
  type: MessageStatus;
  at: string;
  text: string;
}
export type AttachmentId = "handoff-board" | "team-map" | "device-photo";
export type ChatInput =
  | { kind: "text"; text: string }
  | {
      kind: "image";
      attachmentId: AttachmentId;
      imagePath?: string;
      text: string;
    }
  | {
      kind: "call";
      mode: "voice" | "video";
      duration: number;
      outcome: "completed" | "cancelled";
    };
export type ChatEntry = ChatInput & {
  id: string;
  sender: "you" | "teammate";
  at: string;
  status?: MessageStatus;
};
export interface RoutingInfo {
  department: string;
  reason: string;
  recipientId: string;
  at: string;
}
export interface Message {
  resolvedAt?: string;
  resolvedBy?: string;
  routing?: RoutingInfo;
  id: string;
  recipientId: string;
  subject: string;
  body: string;
  priority: Priority;
  status: MessageStatus;
  createdAt: string;
  events: MessageEvent[];
  chat?: ChatEntry[];
  updatedAt?: string;
}
export interface MessageDraft {
  routing?: RoutingInfo;
  recipientId: string;
  subject: string;
  body: string;
  priority: Priority;
}
export interface Snapshot {
  team: TeamMember[];
  shifts: Shift[];
  messages: Message[];
}
