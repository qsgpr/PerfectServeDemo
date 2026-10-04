import { useRef, useState } from "react";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Message } from "../../domain/types";
import { useCare } from "../../state/care-provider";
import { AI_HISTORY_LIMIT, aiHistory } from "../assistant/ai-client";
import { Button, useUI } from "../../components/ui";
import { Sheet } from "../../components/sheet";

export function ConversationControls({
  message,
  isAI,
  disabled,
  onPending,
}: {
  message: Message;
  isAI: boolean;
  disabled: boolean;
  onPending: (pending: boolean) => void;
}) {
  const { styles, colors } = useUI();
  const { resolve } = useCare();
  const [contextOpen, setContextOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const history = aiHistory(message);
  const submit = async () => {
    if (lock.current || disabled || message.resolvedAt) return;
    lock.current = true;
    setPending(true);
    onPending(true);
    setError("");
    try {
      await resolve(message.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not resolve. Try again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
      onPending(false);
    }
  };
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderColor: colors.line,
        gap: 6,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {isAI && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Nova context window"
            onPress={() => setContextOpen(true)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={[styles.small, { color: colors.teal }]}>
              Chat context · {history.length}/{AI_HISTORY_LIMIT}
            </Text>
          </Pressable>
        )}
        {message.resolvedAt ? (
          <Text style={styles.small}>Resolved · Archived</Text>
        ) : (
          <Button
            title={pending ? "Resolving…" : "Resolve conversation"}
            icon="check-circle"
            secondary
            disabled={disabled || pending}
            onPress={() => void submit()}
          />
        )}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.small}>
          {error}
        </Text>
      )}
      {contextOpen && (
        <Sheet
          title="Nova’s context window"
          close={() => setContextOpen(false)}
        >
          <Text style={styles.text}>
            Up to {AI_HISTORY_LIMIT} recent messages from this conversation are
            included with each reply. Older messages stay in your history but
            are outside Nova’s chat context. Calls are excluded; images are
            described by their attachment label rather than analyzed.
          </Text>
          <Text style={styles.small}>
            Your signed-in profile, personal shifts, and live coverage are
            supplied separately. Nova has no access to your other conversations.
            This preview updates as messages arrive; the next message may push
            the oldest one out.
          </Text>
          <Text style={styles.heading}>
            {history.length} messages in the current window
          </Text>
          {history.map((entry, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.label}>
                {entry.role === "user" ? "You" : "Nova"}
              </Text>
              <Text style={styles.text}>{entry.content}</Text>
            </View>
          ))}
          <Text style={styles.small}>
            Resolve this conversation to archive it, then start a new chat for
            fresh conversation context. Your profile and schedule remain
            available.
          </Text>
        </Sheet>
      )}
    </View>
  );
}
export function ResolvedConversation({ message }: { message: Message }) {
  const { styles } = useUI();
  return (
    <View style={{ padding: 14, gap: 10 }}>
      <Text style={styles.text}>
        Resolved{" "}
        {new Date(message.resolvedAt!).toLocaleString("en-US", {
          timeZone: "UTC",
        })}{" "}
        UTC. This history is read-only.
      </Text>
      <Button
        title="Start a new conversation"
        icon="plus"
        onPress={() =>
          router.replace({
            pathname: "/compose",
            params: { recipientId: message.recipientId },
          })
        }
      />
    </View>
  );
}
