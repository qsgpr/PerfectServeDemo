import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCare } from "../../state/care-provider";
import {
  ClockControl,
  GuidedDemoCard,
  PreferencesPanel,
  SimulationPanel,
} from "./demo-controls";
import {
  Button,
  DataGate,
  Empty,
  Page,
  TourBanner,
  useUI,
} from "../../components/ui";
import { canAct } from "../../data/care-service";
import { DemoAction } from "../../domain/types";
export default function Tools() {
  const params = useLocalSearchParams<{ messageId?: string }>();
  const { data, act, tour } = useCare();
  const { colors, styles } = useUI();
  const [selected, setSelected] = useState(params.messageId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const message =
    data?.messages.find((m) => m.id === selected) ?? data?.messages[0];
  const perform = async (action: DemoAction) => {
    if (!message || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await act(message.id, action);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update conversation.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Page
      title="Presentation tools"
      subtitle="Clock, walkthrough, and conversation playback."
    >
      <DataGate>
        <TourBanner />
        <ClockControl />
        <GuidedDemoCard />
        <PreferencesPanel />
        <View style={styles.card}>
          <Text style={styles.heading}>Select a conversation</Text>
          {data?.messages.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="radio"
              accessibilityLabel={m.subject}
              accessibilityState={{ checked: message?.id === m.id }}
              onPress={() => setSelected(m.id)}
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor:
                  message?.id === m.id ? colors.soft : colors.white,
              }}
            >
              <Text style={styles.text}>{m.subject}</Text>
            </Pressable>
          ))}
        </View>
        {message ? (
          <>
            <SimulationPanel message={message} />
            <View style={styles.card}>
              <Button
                title="Open conversation"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/conversation",
                    params: { messageId: message.id },
                  })
                }
              />
              {(
                [
                  ["read", "Mark as read"],
                  ["reply", "Add reply"],
                  ["escalate", "Escalate"],
                ] as const
              ).map(([action, title]) => (
                <Button
                  key={action}
                  title={title}
                  secondary
                  disabled={
                    busy ||
                    tour.status === "running" ||
                    !canAct(message, action)
                  }
                  onPress={() => void perform(action)}
                />
              ))}
              {!!error && (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.danger }}
                >
                  {error}
                </Text>
              )}
            </View>
          </>
        ) : (
          <Empty
            title="No conversations"
            detail="Start a chat to use playback controls."
          />
        )}
      </DataGate>
    </Page>
  );
}
