import type { Shift, Snapshot, TeamMember } from "../../domain/types";
import { DEPARTMENTS } from "../../domain/workflows";
import { memberSpace } from "../../domain/chat";

export interface AIShift {
  department: string;
  start: string;
  end: string;
  name: string;
}
export interface AIContext {
  now: string;
  timezone: "UTC";
  viewer: {
    name: string;
    role: string | null;
    specialty: string | null;
    department: string | null;
  };
  myShifts: AIShift[];
  myShiftsTruncated: boolean;
  scheduleRange: { start: string; end: string } | null;
  coverage: {
    department: string;
    current: AIShift | null;
    next: AIShift | null;
  }[];
  team: { name: string; role: string; department: string }[];
}

// Match identity by account ID, never by display name. Send no email, token,
// other conversations, photo paths, or private account metadata to the AI.
export function buildAIContext(
  account: { id: string; name: string } | null,
  data: Snapshot | null,
  now: string,
): AIContext | undefined {
  if (!account) return;
  const member = data?.team.find((m) => m.userId === account.id);
  const team = data?.team ?? [];
  const shifts = [...(data?.shifts ?? [])].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const describe = (shift?: Shift): AIShift | null =>
    shift
      ? {
          department: shift.department ?? "primary",
          start: shift.start,
          end: shift.end,
          name: team.find((m) => m.id === shift.memberId)?.name ?? "Unassigned",
        }
      : null;
  const own = member ? shifts.filter((s) => s.memberId === member.id) : [];
  const department = (m: TeamMember) => memberSpace(m);
  return {
    now,
    timezone: "UTC",
    viewer: {
      name: member?.name ?? account.name,
      role: member?.role ?? null,
      specialty: member?.specialty ?? null,
      department: member ? department(member) : null,
    },
    myShifts: own.slice(0, 128).map((s) => describe(s)!),
    myShiftsTruncated: own.length > 128,
    scheduleRange: shifts.length
      ? {
          start: shifts[0].start,
          end: shifts.reduce(
            (end, s) => (s.end > end ? s.end : end),
            shifts[0].end,
          ),
        }
      : null,
    coverage: ["primary", ...DEPARTMENTS.map((d) => d.id)].map((id) => {
      const assignments = shifts.filter(
        (s) => (s.department ?? "primary") === id,
      );
      const instant = Date.parse(now);
      return {
        department: id,
        current: describe(
          assignments.find(
            (s) =>
              Date.parse(s.start) <= instant && instant < Date.parse(s.end),
          ),
        ),
        next: describe(assignments.find((s) => Date.parse(s.start) > instant)),
      };
    }),
    team: team
      .slice(0, 100)
      .map((m) => ({ name: m.name, role: m.role, department: department(m) })),
  };
}
