import { useWorkflows } from "../../state/workflow-provider";
import { defaultReachability, shouldAlert } from "../../domain/workflows";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCare } from "../../state/care-provider";
import { useAuth } from "../auth/auth-provider";
import { chatEntries } from "../../domain/chat";
import { useUI } from "../../components/ui";
import {
  observeMessageAlerts,
  setOpenConversation,
  showMessageAlert,
} from "./message-alerts";
export function IncomingNotice() {
  const { data } = useCare();
  const { session } = useAuth();
  const {
    reachability,
    loading: settingsLoading,
    error: settingsError,
  } = useWorkflows();
  const { colors } = useUI();
  const path = usePathname();
  const params = useLocalSearchParams<{ messageId?: string }>();
  const insets = useSafeAreaInsets();
  const current = path === "/conversation" ? (params.messageId ?? null) : null;
  const seen = useRef<Map<string, string> | null>(null);
  const pendingNotices = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = pendingNotices.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const [notice, setNotice] = useState<{ id: string; name: string } | null>(
    null,
  );
  useEffect(() => {
    setOpenConversation(current);
    return () => setOpenConversation(null);
  }, [current]);
  useEffect(() => {
    if (!session) return;
    return observeMessageAlerts((id) =>
      router.push({ pathname: "/conversation", params: { messageId: id } }),
    );
  }, [session]);
  useEffect(() => {
    if (!data || !session) return;
    const latest = new Map(
      data.messages.map((m) => [
        m.id,
        chatEntries(m)
          .filter((e) => e.kind !== "call")
          .at(-1)?.id ?? "",
      ]),
    );
    if (seen.current) {
      for (const message of data.messages) {
        const last = chatEntries(message)
          .filter((e) => e.kind !== "call")
          .at(-1);
        if (
          last?.sender === "teammate" &&
          last.id !== seen.current.get(message.id) &&
          current !== message.id &&
          !settingsLoading &&
          !settingsError &&
          shouldAlert(
            reachability[session.id] ?? defaultReachability(session.id),
            message.priority,
            new Date().toISOString(),
          )
        ) {
          if (
            AppState.currentState === "active" ||
            AppState.currentState === null
          ) {
            // Do not cancel an already detected entry when another snapshot arrives.
            // Unmount cleanup still cancels it when this account's provider disappears.
            const timer = setTimeout(() => {
              pendingNotices.current.delete(timer);
              setNotice({
                id: message.id,
                name:
                  data.team.find((member) => member.id === message.recipientId)
                    ?.name ?? "Your teammate",
              });
            }, 0);
            pendingNotices.current.add(timer);
          }
          void showMessageAlert(session.id, message.id).catch(() => {});
        }
      }
    }
    seen.current = latest;
  }, [data, session, current, reachability, settingsLoading, settingsError]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 1000,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"New message from " + notice.name}
        onPress={() => {
          router.push({
            pathname: "/conversation",
            params: { messageId: notice.id },
          });
          setNotice(null);
        }}
        style={{
          backgroundColor: colors.teal,
          padding: 16,
          borderRadius: 16,
          gap: 4,
        }}
      >
        <Text style={{ color: colors.onAccent, fontWeight: "700" }}>
          New message from {notice.name}
        </Text>
        <Text style={{ color: colors.onAccent }}>
          Tap to open the conversation
        </Text>
      </Pressable>
    </View>
  );
}
