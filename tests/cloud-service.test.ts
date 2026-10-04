import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCloudService } from "../src/data/cloud-service";

describe("cloud roster", () => {
  it("retains the signed-in person's profile so their own on-call shift can be resolved", async () => {
    const rows: Record<string, Record<string, unknown>[]> = {
      shiftline_profiles: [
        {
          id: "viewer",
          user_id: "viewer",
          name: "Cedar Test",
          role: "Team member",
          specialty: "Care coordination",
          initials: "CE",
          color: "#DCEDE7",
          kind: "person",
        },
        {
          id: "other",
          user_id: "other",
          name: "Willow Test",
          role: "Team member",
          specialty: "Care coordination",
          initials: "WI",
          color: "#DCEDE7",
          kind: "person",
        },
      ],
      shiftline_shifts: [
        {
          id: "own-shift",
          member_id: "viewer",
          starts_at: "2026-10-04T03:00:00-04:00",
          ends_at: "2026-10-04T15:00:00-04:00",
        },
      ],
      shiftline_conversations: [],
    };
    const client = {
      from(table: string) {
        let data = rows[table];
        return {
          select() {
            return this;
          },
          neq(column: string, value: string) {
            data = data.filter((row) => row[column] !== value);
            return this;
          },
          order() {
            return Promise.resolve({ data, error: null });
          },
        };
      },
    } as unknown as SupabaseClient;
    const snapshot = await createCloudService(client, "viewer").load();
    expect(snapshot.team.map((m) => m.id)).toEqual(["viewer", "other"]);
    const ownShift = snapshot.shifts[0];
    expect(snapshot.team.find((m) => m.id === ownShift.memberId)?.name).toBe(
      "Cedar Test",
    );
    expect(ownShift.start).toBe("2026-10-04T07:00:00.000Z");
  });
});
