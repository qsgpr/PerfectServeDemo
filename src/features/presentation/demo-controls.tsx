import React from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useCare } from "../../state/care-provider";
import { useTheme } from "../../theme/theme-provider";
import { Button, useUI } from "../../components/ui";
import { GlassSurface } from "../../components/glass";
import { CLOCK_PRESETS, ESCALATION_SECONDS } from "./simulation";
import { Message } from "../../domain/types";
import { canAct } from "../../data/care-service";
export function ClockControl() {
  const { clockIndex, demoNow, advanceClock, tour, isLiveClock, resetClock } =
    useCare();
  const { colors, styles } = useUI();
  const date = new Date(demoNow).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <GlassSurface>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change shift"
        accessibilityHint="Cycles through day shift, evening shift, and next morning"
        accessibilityState={{ disabled: tour.status === "running" }}
        disabled={tour.status === "running"}
        onPress={advanceClock}
        style={({ pressed }) => ({
          padding: 19,
          opacity: pressed ? 0.7 : 1,
          gap: 10,
        })}
      >
        <View style={styles.spread}>
          <View style={styles.row}>
            <Feather name="clock" size={22} color={colors.teal} />
            <Text style={styles.heading}>
              {isLiveClock ? "Live time" : CLOCK_PRESETS[clockIndex].label} ·{" "}
              {demoNow.slice(11, 16)} UTC
            </Text>
          </View>
          <Feather name="repeat" size={19} color={colors.teal} />
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
          {date}
        </Text>
        <Text style={styles.small}>
          {tour.status === "running"
            ? "The walkthrough controls the clock."
            : "Tap to change the shift. Coverage updates across your team."}
        </Text>
      </Pressable>
      {!isLiveClock && (
        <Button
          title="Use real time"
          secondary
          disabled={tour.status === "running"}
          onPress={resetClock}
        />
      )}
    </GlassSurface>
  );
}
export function GuidedDemoCard() {
  const { tour, startTour, loading } = useCare();
  const { colors, styles } = useUI();
  return (
    <View style={[styles.card, { backgroundColor: colors.soft }]}>
      <View style={styles.row}>
        <Feather name="play-circle" size={26} color={colors.teal} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>See a whole shift in 60 seconds.</Text>
          <Text style={styles.subtitle}>
            A handoff, an urgent message, an escalation, and a reply.
          </Text>
        </View>
      </View>
      <Button
        title={
          tour.status === "running"
            ? "Walkthrough running"
            : "Start 60-second walkthrough"
        }
        disabled={loading || tour.status === "running"}
        icon="play"
        onPress={() => {
          startTour();
        }}
      />
      <Text style={styles.small}>
        Follow a shift handoff from the first message to the final reply.
      </Text>
    </View>
  );
}
export function PreferencesPanel({ playback = true }: { playback?: boolean }) {
  const { colors, styles } = useUI();
  const { preferences, update, storageError } = useTheme();
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Make it yours</Text>
      <Text style={styles.subtitle}>
        {playback
          ? "Appearance and playback preferences are saved on this device."
          : "Appearance preferences are saved on this device."}
      </Text>
      <View style={styles.row}>
        {(["system", "light", "dark"] as const).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityLabel={`${mode[0].toUpperCase() + mode.slice(1)} theme`}
            accessibilityState={{ checked: preferences.mode === mode }}
            aria-checked={preferences.mode === mode}
            onPress={() => update({ mode })}
            style={{
              padding: 14,
              minHeight: 48,
              borderWidth: 1,
              borderColor:
                preferences.mode === mode ? colors.teal : colors.line,
              borderRadius: 12,
              backgroundColor:
                preferences.mode === mode ? colors.accentSoft : colors.white,
            }}
          >
            <Text style={styles.text}>
              {mode[0].toUpperCase() + mode.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {(
        [
          {
            key: "autoReply",
            label: "Auto-reply to new messages",
            detail: "Automatically play replies to new messages.",
          },
          {
            key: "haptics",
            label: "Haptic feedback",
            detail: "A subtle tap on supported phones.",
          },
          {
            key: "reduceMotion",
            label: "Reduce animations",
            detail: "System Reduce Motion is always respected.",
          },
        ] as const
      )
        .filter((item) => playback || item.key !== "autoReply")
        .map((item) => (
          <View key={item.key} style={styles.spread}>
            <View style={{ flex: 1 }}>
              <Text style={styles.text}>{item.label}</Text>
              <Text style={styles.small}>{item.detail}</Text>
            </View>
            <Switch
              accessibilityLabel={item.label}
              value={preferences[item.key]}
              onValueChange={(value) => update({ [item.key]: value })}
              trackColor={{ false: colors.line, true: colors.teal }}
            />
          </View>
        ))}
      {storageError && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {storageError}
        </Text>
      )}
    </View>
  );
}
export function SimulationPanel({ message }: { message: Message }) {
  const { simulations, simulate, stopSimulation, tour } = useCare();
  const { colors, styles } = useUI();
  const state = simulations[message.id];
  const running =
    !!state && ["waiting", "read", "typing", "countdown"].includes(state.phase);
  const guided = tour.status === "running" && tour.messageId === message.id;
  const labels = {
    waiting: "Waiting for a response…",
    read: "Your message has been read.",
    typing: "Your teammate is typing…",
    replied: "Reply received.",
    countdown: "Waiting for acknowledgment.",
    escalated: "Escalated to the backup team.",
    stopped: "Playback stopped.",
    error: state?.error ?? "Playback failed.",
  };
  return (
    <GlassSurface style={{ padding: 20, gap: 14 }}>
      <View style={styles.spread}>
        <Text style={styles.heading}>Conversation activity</Text>
        <Feather name="activity" size={22} color={colors.teal} />
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.subtitle}>
        {message.status === "Replied"
          ? "Your teammate has replied."
          : state
            ? labels[state.phase]
            : "Follow read receipts and replies as the conversation progresses."}
      </Text>
      {state?.phase === "typing" && (
        <Text
          accessibilityLabel="Typing indicator"
          style={{ color: colors.teal, fontSize: 28, letterSpacing: 8 }}
        >
          •••
        </Text>
      )}
      {state?.phase === "countdown" && (
        <>
          <Text
            accessibilityRole="timer"
            style={[styles.title, { color: colors.urgentInk }]}
          >
            {state.remaining}s until escalation
          </Text>
          <View
            style={{ height: 6, borderRadius: 3, backgroundColor: colors.line }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                width: `${((ESCALATION_SECONDS - (state.remaining ?? 0)) / ESCALATION_SECONDS) * 100}%`,
                backgroundColor: colors.urgentInk,
              }}
            />
          </View>
          <Text style={styles.small}>
            If no reply arrives, the message escalates to the backup team. A
            reply cancels the countdown.
          </Text>
        </>
      )}
      <View style={styles.row}>
        <Button
          title="Play response"
          icon="play"
          secondary
          disabled={running || guided || !canAct(message, "reply")}
          onPress={() => simulate(message.id, "reply")}
        />
        {message.priority === "Urgent" && (
          <Button
            title="Start escalation timer"
            secondary
            icon="clock"
            disabled={running || guided || !canAct(message, "escalate")}
            onPress={() => simulate(message.id, "escalation")}
          />
        )}
        {running && !guided && (
          <Button
            title="Stop playback"
            secondary
            onPress={() => stopSimulation(message.id)}
          />
        )}
      </View>
      <Text style={styles.small}>
        {guided
          ? "The walkthrough controls this conversation. Stop the walkthrough to take over."
          : "Playback stops when you leave the app."}
      </Text>
    </GlassSurface>
  );
}
