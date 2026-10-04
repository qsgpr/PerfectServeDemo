import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useCare } from "../state/care-provider";
import { Message, Presence, TeamMember } from "../domain/types";
import { Colors, useTheme } from "../theme/theme-provider";
import { router, useSegments } from "expo-router";
import { chatPreview } from "../domain/chat";
import { tourStep } from "../features/presentation/simulation";
export function useUI() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme.colors), [theme.colors]);
  return { ...theme, styles };
}
const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.paper },
    content: {
      width: "100%",
      maxWidth: 1040,
      alignSelf: "center",
      padding: 20,
      paddingBottom: 40,
      gap: 20,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    spread: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    title: {
      fontSize: 32,
      lineHeight: 39,
      fontWeight: "700",
      color: colors.ink,
      letterSpacing: -1,
    },
    subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
    heading: { fontSize: 19, fontWeight: "700", color: colors.ink },
    text: { fontSize: 15, lineHeight: 23, color: colors.ink },
    small: { fontSize: 12, lineHeight: 18, color: colors.muted },
    eyebrow: {
      fontSize: 11,
      letterSpacing: 1.8,
      fontWeight: "700",
      color: colors.teal,
    },
    card: {
      backgroundColor: colors.white,
      padding: 20,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 14,
    },
    input: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: "#9AAEA6",
      borderRadius: 12,
      minHeight: 50,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 16,
      color: colors.ink,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.ink,
      marginBottom: 8,
    },
  });
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  const { colors } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 12,
        backgroundColor: secondary ? colors.soft : colors.teal,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {icon && (
        <Feather
          name={icon}
          size={17}
          color={secondary ? colors.teal : colors.onAccent}
        />
      )}
      <Text
        style={{
          color: secondary ? colors.teal : colors.onAccent,
          fontSize: 14,
          fontWeight: "600",
          flexShrink: 1,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Page({
  title,
  subtitle,
  children,
  action,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  compact?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { styles } = useUI();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const nativeTab =
    Platform.OS === "ios" && (segments as string[]).includes("(tabs)");
  return (
    <ScrollView
      testID="page-scroll"
      style={styles.page}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: nativeTab ? 88 + insets.bottom : 40 + insets.bottom },
      ]}
    >
      <View style={[styles.spread, compact && { flexWrap: "nowrap" }]}>
        <View style={{ gap: 7, flexShrink: 1 }}>
          <Text
            accessibilityRole="header"
            style={[styles.title, compact && { fontSize: 24, lineHeight: 32 }]}
            numberOfLines={compact ? 1 : undefined}
          >
            {title}
          </Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {action}
      </View>
      <View style={{ gap: 20 }}>{children}</View>
    </ScrollView>
  );
}
export function DataGate({ children }: { children: React.ReactNode }) {
  const { styles } = useUI();
  const { loading, error, reload, data } = useCare();
  if (loading) return <LoadingSkeleton />;
  if (error || !data)
    return (
      <Page
        title="Let’s try that again"
        subtitle="Your team data is unavailable."
      >
        <Text accessibilityRole="alert" style={styles.text}>
          {error}
        </Text>
        <Button title="Retry loading" onPress={() => void reload()} />
      </Page>
    );
  return <>{children}</>;
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  const { colors, styles } = useUI();
  return (
    <View style={styles.card}>
      <Feather name="inbox" size={25} color={colors.teal} />
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.subtitle}>{detail}</Text>
    </View>
  );
}
export function Avatar({
  member,
  large = false,
}: {
  member: TeamMember;
  large?: boolean;
}) {
  return (
    <View
      style={{
        flexShrink: 0,
        width: large ? 64 : 44,
        height: large ? 64 : 44,
        borderRadius: large ? 22 : 15,
        backgroundColor: member.color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#192F39",
          fontWeight: "700",
          fontSize: large ? 21 : 14,
        }}
      >
        {member.initials}
      </Text>
    </View>
  );
}
export function PresenceLabel({
  presence = "available",
}: {
  presence?: Presence;
}) {
  const { colors, styles } = useUI();
  const labels: Record<Presence, string> = {
    available: "Available",
    busy: "Busy",
    "in-call": "In a call",
    offline: "Offline",
  };
  const color =
    presence === "available"
      ? colors.teal
      : presence === "offline"
        ? colors.muted
        : colors.urgentInk;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }}
      />
      <Text style={[styles.small, { color }]}>{labels[presence]}</Text>
    </View>
  );
}
export function Badge({ label }: { label: string }) {
  const { colors } = useUI();
  const urgent = label === "Urgent" || label === "Escalated";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: urgent ? colors.urgentBg : colors.soft,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: urgent ? colors.urgentInk : colors.teal,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export function MessageCard({
  message,
  member,
  onPress,
}: {
  message: Message;
  member?: TeamMember;
  onPress: () => void;
}) {
  const { colors, styles } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${message.subject}, ${member?.name}, ${message.priority}, ${message.resolvedAt ? "Resolved" : message.status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.spread, { flexWrap: "nowrap" }]}>
        <View
          style={[styles.row, { flex: 1, minWidth: 0, flexWrap: "nowrap" }]}
        >
          {member && <Avatar member={member} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[styles.text, { fontWeight: "600" }]}
            >
              {member?.name ?? "Team member"}
            </Text>
            <Text style={styles.small}>
              {time(message.updatedAt ?? message.createdAt)} ·{" "}
              {message.priority}
            </Text>
          </View>
        </View>
        <Badge label={message.resolvedAt ? "Resolved" : message.status} />
      </View>
      <View style={[styles.spread, { flexWrap: "nowrap" }]}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.text, { fontWeight: "600" }]}>
            {message.subject}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {chatPreview(message)}
          </Text>
        </View>
        <Feather name="arrow-up-right" size={19} color={colors.teal} />
      </View>
    </Pressable>
  );
}
export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

export function FadeIn({ children }: { children: React.ReactNode }) {
  const { reducedMotion } = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  return <Animated.View style={{ opacity, gap: 24 }}>{children}</Animated.View>;
}
export function LoadingSkeleton() {
  const { colors, styles, reducedMotion } = useUI();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  return (
    <View
      accessibilityLabel="Loading your team"
      accessibilityRole="progressbar"
      style={[styles.page, { padding: 24, gap: 20 }]}
    >
      <Text style={styles.text}>Gathering your team…</Text>
      <Animated.View style={{ opacity, gap: 20 }}>
        {[64, 180, 120, 120].map((height, index) => (
          <View
            key={index}
            style={{
              height,
              maxWidth: 1040,
              width: "100%",
              alignSelf: "center",
              borderRadius: 18,
              backgroundColor: colors.line,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}
export function TourBanner() {
  const { tour, stopTour } = useCare();
  const { colors, styles } = useUI();
  if (tour.status === "idle") return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.soft }]}>
      <View style={styles.spread}>
        <Text accessibilityLiveRegion="polite" style={styles.heading}>
          {tour.status === "running" || tour.status === "complete"
            ? tourStep(tour.seconds)
            : tour.status === "error"
              ? "Walkthrough interrupted"
              : "Walkthrough stopped"}
        </Text>
        <Text style={styles.small}>{tour.seconds}/60 seconds</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 60, now: tour.seconds }}
        style={{ height: 5, borderRadius: 3, backgroundColor: colors.line }}
      >
        <View
          style={{
            height: 5,
            borderRadius: 3,
            width: `${(tour.seconds / 60) * 100}%`,
            backgroundColor: colors.teal,
          }}
        />
      </View>
      {tour.error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {tour.error}
        </Text>
      )}
      <View style={styles.row}>
        {tour.messageId && (
          <Button
            title="Open conversation"
            secondary
            onPress={() =>
              router.navigate({
                pathname: "/conversation",
                params: { messageId: tour.messageId },
              })
            }
          />
        )}
        {tour.status === "running" && (
          <Button title="Stop walkthrough" secondary onPress={stopTour} />
        )}
      </View>
    </View>
  );
}
