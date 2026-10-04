import type { Message, Priority, Shift, TeamMember } from "./types";
import { memberSpace, chatPreview } from "./chat";
export const DEPARTMENTS = [
  { id: "medicine", name: "Medicine" },
  { id: "nursing", name: "Nursing" },
  { id: "pharmacy", name: "Pharmacy" },
  { id: "cardiology", name: "Cardiology" },
  { id: "coordination", name: "Care coordination" },
] as const;
export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];
export interface Reachability {
  profileId: string;
  availability: "available" | "busy" | "offline";
  alerts: "all" | "urgent" | "none";
  quietStart: number | null;
  quietEnd: number | null;
  backupId: string | null;
}
export const defaultReachability = (profileId: string): Reachability => ({
  profileId,
  availability: "available",
  alerts: "all",
  quietStart: null,
  quietEnd: null,
  backupId: null,
});
export function inQuietHours(settings: Reachability, now: string) {
  if (settings.quietStart === null || settings.quietEnd === null) return false;
  const date = new Date(now);
  const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
  return settings.quietStart < settings.quietEnd
    ? minute >= settings.quietStart && minute < settings.quietEnd
    : minute >= settings.quietStart || minute < settings.quietEnd;
}
export function canReach(
  settings: Reachability,
  priority: Priority,
  now: string,
) {
  return (
    settings.availability !== "offline" &&
    (priority === "Urgent" ||
      (settings.availability === "available" && !inQuietHours(settings, now)))
  );
}
export function shouldAlert(
  settings: Reachability,
  priority: Priority,
  now: string,
) {
  return (
    settings.alerts !== "none" &&
    (priority === "Urgent" ||
      (settings.alerts === "all" && !inQuietHours(settings, now)))
  );
}
export function departmentCoverage(
  shifts: Shift[],
  department: DepartmentId,
  now: string,
) {
  const sorted = shifts
    .filter((s) => s.department === department)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return {
    current: sorted.find(
      (s) =>
        Date.parse(s.start) <= Date.parse(now) &&
        Date.parse(now) < Date.parse(s.end),
    ),
    next: sorted.find((s) => Date.parse(s.start) > Date.parse(now)),
  };
}
export function resolveDepartmentRoute(
  team: TeamMember[],
  shifts: Shift[],
  settings: Record<string, Reachability>,
  department: DepartmentId,
  priority: Priority,
  now: string,
  senderId: string,
) {
  const { current, next } = departmentCoverage(shifts, department, now);
  const primary = team.find((m) => m.id === current?.memberId);
  if (!primary)
    return {
      reason: "No on-call coverage for this department.",
      isBackup: false,
    };
  if (
    primary.id !== senderId &&
    canReach(
      settings[primary.id] ?? defaultReachability(primary.id),
      priority,
      now,
    )
  )
    return {
      recipient: primary,
      shift: current,
      reason: "On-call coverage",
      isBackup: false,
    };
  const backupId = settings[primary.id]?.backupId ?? next?.memberId;
  const backup = team.find(
    (m) =>
      m.id === backupId &&
      m.id !== primary.id &&
      m.id !== senderId &&
      m.kind !== "ai" &&
      memberSpace(m) === department,
  );
  if (
    backup &&
    canReach(
      settings[backup.id] ?? defaultReachability(backup.id),
      priority,
      now,
    )
  )
    return {
      recipient: backup,
      shift: current,
      reason:
        primary.id === senderId
          ? "Backup coverage · you are on call"
          : "Backup coverage · on-call teammate unavailable",
      isBackup: true,
    };
  return {
    reason:
      primary.id === senderId
        ? "You are on call; no reachable backup is assigned."
        : "The on-call teammate and backup are unavailable.",
    isBackup: false,
  };
}
export interface HandoffItem {
  id: string;
  subject: string;
  priority: Priority;
  status: Message["status"];
  preview: string;
}
export interface Handoff {
  id: string;
  ownerId: string;
  recipientId: string;
  department: DepartmentId;
  note: string;
  items: HandoffItem[];
  status: "Pending" | "Accepted" | "Cancelled";
  createdAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
}
export interface HandoffDraft {
  recipientId: string;
  department: DepartmentId;
  note: string;
  conversationIds: string[];
}
export interface WorkflowSnapshot {
  reachability: Record<string, Reachability>;
  handoffs: Handoff[];
}
export function handoffItems(
  messages: Message[],
  ids: string[],
): HandoffItem[] {
  return ids.map((id) => {
    const m = messages.find((m) => m.id === id);
    if (!m) throw new Error("A selected conversation is unavailable.");
    return {
      id,
      subject: m.subject,
      priority: m.priority,
      status: m.status,
      preview: chatPreview(m).slice(0, 500),
    };
  });
}
export function validateReachability(value: Reachability) {
  if (
    !["available", "busy", "offline"].includes(value.availability) ||
    !["all", "urgent", "none"].includes(value.alerts)
  )
    throw new Error("Choose valid reachability settings.");
  if (
    (value.quietStart === null) !== (value.quietEnd === null) ||
    [value.quietStart, value.quietEnd].some(
      (m) => m !== null && (!Number.isInteger(m) || m < 0 || m > 1439),
    ) ||
    (value.quietStart !== null && value.quietStart === value.quietEnd)
  )
    throw new Error("Enter different quiet-hour start and end times.");
}
export function validateHandoff(draft: HandoffDraft) {
  if (!draft.recipientId) throw new Error("Choose the incoming teammate.");
  if (!DEPARTMENTS.some((d) => d.id === draft.department))
    throw new Error("Choose a department.");
  if (!draft.note.trim() || draft.note.length > 4000)
    throw new Error("Write a handoff note of at most 4,000 characters.");
  if (
    draft.conversationIds.length > 20 ||
    new Set(draft.conversationIds).size !== draft.conversationIds.length
  )
    throw new Error("Select at most 20 different conversations.");
}
export function timeInput(minutes: number | null) {
  return minutes === null
    ? ""
    : `${Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}
export function parseTimeInput(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Use HH:MM in UTC for quiet hours.");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
