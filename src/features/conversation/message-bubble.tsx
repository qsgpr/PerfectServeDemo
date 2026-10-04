import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatDuration } from "../../domain/chat";
import { AttachmentId, ChatEntry, TeamMember } from "../../domain/types";
import { time, useUI } from "../../components/ui";
import { CHAT_IMAGES, SharedImage } from "./shared-image";

export function Bubble({
  entry,
  member,
  preview,
}: {
  entry: ChatEntry;
  member?: TeamMember;
  preview: (id: AttachmentId, path?: string) => void;
}) {
  const { colors, styles } = useUI();
  const { reducedMotion } = useUI();
  const [appear] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reducedMotion) {
      appear.setValue(1);
      return;
    }
    Animated.spring(appear, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [appear, reducedMotion]);
  if (entry.kind === "call")
    return (
      <View
        style={{
          alignSelf: "center",
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 20,
          padding: 16,
          gap: 8,
          marginVertical: 8,
          minWidth: 220,
        }}
      >
        <View style={styles.row}>
          <Feather
            name={entry.mode === "voice" ? "phone" : "video"}
            color={colors.teal}
            size={18}
          />
          <Text style={[styles.text, { fontWeight: "600" }]}>
            {entry.mode === "voice" ? "Voice call" : "Video call"} ·{" "}
            {entry.outcome === "cancelled"
              ? "Cancelled"
              : formatDuration(entry.duration)}
          </Text>
        </View>
        <Text style={styles.small}>{time(entry.at)} UTC</Text>
      </View>
    );
  const outgoing = entry.sender === "you";
  const ink = outgoing ? colors.onAccent : colors.ink;
  return (
    <Animated.View
      testID={outgoing ? "outgoing-bubble" : "incoming-bubble"}
      style={{
        alignSelf: outgoing ? "flex-end" : "flex-start",
        maxWidth: "84%",
        gap: 6,
        opacity: appear,
        transform: [
          {
            translateY: appear.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
          {
            scale: appear.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
        ],
      }}
    >
      {!outgoing && (
        <Text style={[styles.small, { marginLeft: 4 }]}>{member?.name}</Text>
      )}
      <View
        style={{
          padding: entry.kind === "image" ? 8 : 16,
          borderRadius: 22,
          borderBottomRightRadius: outgoing ? 6 : 22,
          borderBottomLeftRadius: outgoing ? 22 : 6,
          backgroundColor: outgoing ? colors.teal : colors.white,
          borderWidth: outgoing ? 0 : 1,
          borderColor: colors.line,
          gap: 10,
          minWidth: entry.kind === "image" ? 250 : undefined,
        }}
      >
        {entry.kind === "image" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              "Open image: " +
              (entry.attachmentId === "device-photo"
                ? "Shared photo"
                : CHAT_IMAGES.find((a) => a.id === entry.attachmentId)?.title)
            }
            onPress={() => preview(entry.attachmentId, entry.imagePath)}
            style={{ borderRadius: 16, overflow: "hidden" }}
          >
            <SharedImage id={entry.attachmentId} path={entry.imagePath} />
          </Pressable>
        )}
        {!!entry.text && (
          <Text
            selectable
            style={{
              color: ink,
              fontSize: 16,
              lineHeight: 24,
              paddingHorizontal: entry.kind === "image" ? 8 : 0,
            }}
          >
            {entry.text}
          </Text>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 5,
          alignSelf: outgoing ? "flex-end" : "flex-start",
          alignItems: "center",
          marginHorizontal: 4,
        }}
      >
        <Text style={styles.small}>{time(entry.at)}</Text>
        {outgoing && (
          <>
            <Feather
              name={entry.status === "Sent" ? "check" : "check-circle"}
              color={colors.muted}
              size={12}
            />
            <Text style={styles.small}>
              {entry.status === "Replied" ? "Read" : (entry.status ?? "Sent")}
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}
