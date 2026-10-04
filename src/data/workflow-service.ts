import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalStorage } from "./local-service";
import type { CareService } from "./care-service";
import { cloudMessage, type CloudConversation } from "./cloud-model";
import { memberSpace } from "../domain/chat";
import type { Message, MessageDraft, Snapshot } from "../domain/types";
import {
  handoffItems,
  resolveDepartmentRoute,
  validateHandoff,
  validateReachability,
  type DepartmentId,
  type Handoff,
  type HandoffDraft,
  type Reachability,
  type WorkflowSnapshot,
} from "../domain/workflows";
export type LocalCareContext = () => {
  data: Snapshot | null;
  send: CareService["send"];
};
export interface WorkflowService {
  setLocalContext?: (value: LocalCareContext) => void;
  load(): Promise<WorkflowSnapshot>;
  settings(value: Reachability): Promise<void>;
  share(value: HandoffDraft, key: string): Promise<void>;
  accept(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  route(
    department: DepartmentId,
    draft: MessageDraft,
    key: string,
  ): Promise<Message>;
}
export function createCloudWorkflow(
  client: SupabaseClient,
  userId: string,
): WorkflowService {
  const mutate = async (op: string, value: unknown, key = "") => {
    const { data, error } = await client.rpc("shiftline_workflow", {
      op,
      value,
      request_key: key,
    });
    if (error) throw new Error(error.message);
    return data as string;
  };
  return {
    async load() {
      const [prefs, handoffs] = await Promise.all([
        client.from("shiftline_reachability").select("*"),
        client
          .from("shiftline_handoffs")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (prefs.error || handoffs.error)
        throw new Error((prefs.error ?? handoffs.error)!.message);
      return {
        reachability: Object.fromEntries(
          (prefs.data ?? []).map((p) => [
            p.profile_id,
            {
              profileId: p.profile_id,
              availability: p.availability,
              alerts: p.alerts,
              quietStart: p.quiet_start,
              quietEnd: p.quiet_end,
              backupId: p.backup_id,
            } as Reachability,
          ]),
        ),
        handoffs: (handoffs.data ?? []).map(
          (h) =>
            ({
              id: h.id,
              ownerId: h.owner_id,
              recipientId: h.recipient_id,
              department: h.department,
              note: h.note,
              items: h.items,
              status: h.status,
              createdAt: h.created_at,
              acceptedAt: h.accepted_at,
              acceptedBy: h.accepted_by,
            }) as Handoff,
        ),
      };
    },
    settings: async (v) => {
      validateReachability(v);
      await mutate("settings", v);
    },
    share: async (v, key) => {
      validateHandoff(v);
      await mutate("share", v, key);
    },
    accept: async (id) => {
      await mutate("accept", { id });
    },
    cancel: async (id) => {
      await mutate("cancel", { id });
    },
    async route(department, draft, key) {
      const id = await mutate("route", { ...draft, department }, key);
      const { data, error } = await client
        .from("shiftline_conversations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return cloudMessage(data as CloudConversation, userId);
    },
  };
}
export const WORKFLOW_KEY = "shiftline.workflows.v1";
type LocalState = WorkflowSnapshot & { requests: Record<string, string> };
export function createLocalWorkflow(
  storage: LocalStorage,
  userId: string,
  context: LocalCareContext = () => ({
    data: null,
    send: async () => {
      throw new Error("Team data unavailable.");
    },
  }),
  now = () => new Date().toISOString(),
): WorkflowService {
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<LocalState> => {
    const raw = await storage.getItem(WORKFLOW_KEY);
    if (!raw) return { reachability: {}, handoffs: [], requests: {} };
    try {
      const value = JSON.parse(raw);
      if (
        !value.reachability ||
        !Array.isArray(value.handoffs) ||
        !value.requests
      )
        throw Error();
      return value;
    } catch {
      throw new Error("Saved handoffs could not be restored.");
    }
  };
  const change = <T>(fn: (value: LocalState) => Promise<T> | T) => {
    const job = queue.then(async () => {
      const state = await read();
      const result = await fn(state);
      await storage.setItem(WORKFLOW_KEY, JSON.stringify(state));
      return result;
    });
    queue = job.catch(() => {});
    return job;
  };
  return {
    setLocalContext(value) {
      context = value;
    },
    async load() {
      const v = await read();
      return {
        reachability: v.reachability,
        handoffs: v.handoffs.filter(
          (h) => h.ownerId === userId || h.recipientId === userId,
        ),
      };
    },
    settings: (v) =>
      change((state) => {
        validateReachability(v);
        if (v.profileId !== userId)
          throw new Error("Only your settings can be changed.");
        const people = context().data?.team ?? [];
        if (
          v.backupId &&
          !people.some(
            (m) =>
              m.id === v.backupId &&
              m.id !== userId &&
              m.kind !== "ai" &&
              memberSpace(m) ===
                memberSpace(people.find((m) => m.id === userId)),
          )
        )
          throw new Error(
            "Choose another teammate in your department as backup.",
          );
        state.reachability[userId] = { ...v };
      }),
    share: (v, key) =>
      change((state) => {
        validateHandoff(v);
        if (!key || key.length > 200) throw new Error("Invalid request key.");
        if (state.requests[userId + ":" + key]) return;
        const data = context().data;
        const member = data?.team.find(
          (m) =>
            m.id === v.recipientId &&
            m.kind !== "ai" &&
            memberSpace(m) === v.department,
        );
        if (!member || member.id === userId)
          throw new Error("Choose another teammate.");
        const id = `handoff-${Date.now()}-${Math.random()}`;
        state.handoffs.unshift({
          id,
          ownerId: userId,
          recipientId: v.recipientId,
          department: v.department,
          note: v.note.trim(),
          items: handoffItems(data!.messages, v.conversationIds),
          status: "Pending",
          createdAt: now(),
          acceptedAt: null,
          acceptedBy: null,
        });
        state.requests[userId + ":" + key] = id;
      }),
    accept: (id) =>
      change((state) => {
        const h = state.handoffs.find((h) => h.id === id);
        if (!h || h.recipientId !== userId)
          throw new Error(
            "Only the incoming teammate can accept this handoff.",
          );
        if (h.status === "Cancelled")
          throw new Error("This handoff was cancelled.");
        if (h.status === "Pending") {
          h.status = "Accepted";
          h.acceptedAt = now();
          h.acceptedBy = userId;
        }
      }),
    cancel: (id) =>
      change((state) => {
        const h = state.handoffs.find((h) => h.id === id);
        if (!h || h.ownerId !== userId)
          throw new Error("Only the sender can cancel this handoff.");
        if (h.status === "Accepted")
          throw new Error("An accepted handoff cannot be cancelled.");
        h.status = "Cancelled";
      }),
    async route(department, draft, key) {
      const state = await read();
      const data = context().data;
      if (!data) throw new Error("Team data unavailable.");
      const route = resolveDepartmentRoute(
        data.team,
        data.shifts,
        state.reachability,
        department,
        draft.priority,
        now(),
        userId,
      );
      if (!route.recipient) throw new Error(route.reason);
      return context().send(
        {
          ...draft,
          recipientId: route.recipient.id,
          routing: {
            department,
            reason: route.reason,
            recipientId: route.recipient.id,
            at: now(),
          },
        },
        key,
      );
    },
  };
}
