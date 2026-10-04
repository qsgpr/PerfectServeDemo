import { SupabaseClient } from "@supabase/supabase-js";
import { CareService } from "./care-service";
import { Snapshot, TeamMember } from "../domain/types";
import { cloudMessage, CloudConversation } from "./cloud-model";
export function createCloudService(
  client: SupabaseClient,
  userId: string,
): CareService {
  const read = async (id: string) => {
    const { data, error } = await client
      .from("shiftline_conversations")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return cloudMessage(data as CloudConversation, userId);
  };
  const mutate = async (
    op: string,
    cid: string | null,
    value: unknown = {},
    key = "",
    signal?: AbortSignal,
  ) => {
    if (signal?.aborted) throw new Error("Action cancelled.");
    let request = client.rpc("shiftline_mutate", {
      op,
      cid,
      value,
      request_key: key,
    });
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    if (error) throw new Error(error.message);
    return read(data as string);
  };
  return {
    async load(): Promise<Snapshot> {
      const [profiles, shifts, conversations] = await Promise.all([
        client.from("shiftline_profiles").select("*").order("name"),
        client.from("shiftline_shifts").select("*").order("starts_at"),
        client
          .from("shiftline_conversations")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);
      for (const result of [profiles, shifts, conversations])
        if (result.error) throw new Error(result.error.message);
      return {
        team: (profiles.data ?? []).map(
          (p) =>
            ({
              id: p.id,
              department: p.department,
              userId: p.user_id ?? undefined,
              name: p.name,
              role: p.role,
              specialty: p.specialty,
              initials: p.initials,
              color: p.color,
              kind: p.kind,
              presence: p.presence,
            }) as TeamMember,
        ),
        shifts: (shifts.data ?? []).map((s) => ({
          id: s.id,
          memberId: s.member_id,
          department: s.department ?? undefined,
          start: new Date(s.starts_at).toISOString(),
          end: new Date(s.ends_at).toISOString(),
        })),
        messages: (conversations.data ?? []).map((c) =>
          cloudMessage(c as CloudConversation, userId),
        ),
      };
    },
    send: (draft, key, signal) => mutate("send", null, draft, key, signal),
    resolve: (id) => mutate("resolve", id),
    post: (id, input, key) => mutate("post", id, input, key),
    act: (id, action, signal) => mutate(action, id, {}, "", signal),
    receive: (id, text, replyTo, signal) =>
      mutate(
        "receive",
        id,
        { kind: "text", text, replyTo },
        "ai-" + replyTo,
        signal,
      ),
  };
}
