import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../data/supabase";
import { useAuth } from "../auth/auth-provider";
/** Ephemeral typing events contain identity and a boolean, never draft text. */
export function useChatTyping(messageId: string, peerId?: string) {
  const { session } = useAuth();
  const userId = session?.id;
  const [peerTyping, setPeerTyping] = useState(false);
  const connection = useRef<RealtimeChannel | null>(null);
  const ready = useRef(false);
  const lastActivity = useRef(0);
  const lastSent = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = (typing: boolean) => {
    if (!ready.current || !connection.current || !userId) return;
    void connection.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, typing },
    });
  };
  const stop = () => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
    lastActivity.current = 0;
    lastSent.current = 0;
    send(false);
  };
  const activity = (hasText: boolean) => {
    if (!hasText) {
      stop();
      return;
    }
    const now = Date.now();
    lastActivity.current = now;
    if (now - lastSent.current >= 1000) {
      send(true);
      lastSent.current = now;
    }
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(stop, 2500);
  };
  useEffect(() => {
    if (!supabase || !userId || !peerId) return;
    const client = supabase;
    let active = true;
    const channel = client.channel("shiftline:conversation:" + messageId, {
      config: { private: true, broadcast: { self: false } },
    });
    connection.current = channel;
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (
          !active ||
          payload?.userId !== peerId ||
          typeof payload.typing !== "boolean"
        )
          return;
        if (expiry.current) clearTimeout(expiry.current);
        setPeerTyping(payload.typing);
        if (payload.typing)
          expiry.current = setTimeout(() => {
            if (active) setPeerTyping(false);
          }, 4000);
      })
      .subscribe((status) => {
        if (!active) return;
        ready.current = status === "SUBSCRIBED";
        if (ready.current && lastActivity.current > Date.now() - 2500) {
          void channel.send({
            type: "broadcast",
            event: "typing",
            payload: { userId, typing: true },
          });
        }
        if (!ready.current) setPeerTyping(false);
      });
    const pause = () => {
      if (idle.current) clearTimeout(idle.current);
      if (expiry.current) clearTimeout(expiry.current);
      lastActivity.current = 0;
      lastSent.current = 0;
      if (ready.current)
        void channel.send({
          type: "broadcast",
          event: "typing",
          payload: { userId, typing: false },
        });
      setPeerTyping(false);
    };
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") pause();
    });
    const visibility = () => {
      if (document.hidden) pause();
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      pause();
      ready.current = false;
      connection.current = null;
      app.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", visibility);
      // Let the stop event leave the socket before unsubscribing.
      void channel
        .send({
          type: "broadcast",
          event: "typing",
          payload: { userId, typing: false },
        })
        .finally(() => client.removeChannel(channel));
    };
  }, [messageId, peerId, userId]);
  return { peerTyping, activity, stop };
}
