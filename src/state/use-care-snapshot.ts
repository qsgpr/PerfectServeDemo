import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CLOCK_KEY } from "../data/local-service";
import { supabase } from "../data/supabase";
import type { CareService } from "../data/care-service";
import type { Message, Snapshot } from "../domain/types";
// Owns the loaded snapshot and replaces subscriptions when the account/service changes.
export function useCareSnapshot(
  service: CareService,
  restoreClock: (index: number) => void,
  cloud: boolean,
  userId?: string,
) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const merge = useCallback(
    (message: Message) =>
      setData((previous) =>
        previous
          ? {
              ...previous,
              messages: [
                message,
                ...previous.messages.filter((m) => m.id !== message.id),
              ].sort((a, b) =>
                (b.updatedAt ?? b.createdAt).localeCompare(
                  a.updatedAt ?? a.createdAt,
                ),
              ),
            }
          : previous,
      ),
    [],
  );
  useEffect(() => {
    let active = true;
    Promise.all([service.load(), AsyncStorage.getItem(CLOCK_KEY)])
      .then(([value, rawClock]) => {
        if (!active) return;
        const index = Number(rawClock ?? -1);
        const restored = [-1, 0, 1, 2].includes(index) ? index : -1;
        restoreClock(restored);
        setData(value);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to load team data.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [service, restoreClock]);
  useEffect(() => {
    if (!supabase || !cloud || !userId) return;
    let active = true;
    let inFlight = false;
    let queued = false;
    const sync = async () => {
      if (!active) return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        do {
          queued = false;
          const snapshot = await service.load();
          if (active) {
            setData(snapshot);
            setError(null);
          }
        } while (active && queued);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to sync conversations.",
          );
      } finally {
        inFlight = false;
      }
    };
    const channel = supabase
      .channel("shiftline-" + userId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shiftline_conversations" },
        () => void sync(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shiftline_profiles" },
        () => void sync(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void sync();
      });
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    // Periodic reconciliation covers dropped realtime connections and returning browsers.
    const timer = setInterval(() => void sync(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
      foreground.remove();
      void supabase?.removeChannel(channel);
    };
  }, [cloud, service, userId]);
  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await service.load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load team data.");
    } finally {
      setLoading(false);
    }
  };
  return { data, loading, error, reload, merge };
}
