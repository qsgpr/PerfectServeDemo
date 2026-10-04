import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { DEPARTMENTS } from "../../domain/workflows";
import { memberSpace, TEAM_SPACES } from "../../domain/chat";
import { Message, TeamMember } from "../../domain/types";
import { Avatar, Badge, useUI } from "../../components/ui";
import { IconButton } from "../../components/icon-button";
export function ConversationHeader({
  message,
  member,
  guided,
  busy,
  onShowDetails,
  onCall,
}: {
  message: Message;
  member?: TeamMember;
  guided: boolean;
  busy: boolean;
  onShowDetails: () => void;
  onCall: (mode: "voice" | "video") => void;
}) {
  const { colors, styles } = useUI();
  const isAI = member?.kind === "ai";
  const space = TEAM_SPACES.find((s) => s.id === memberSpace(member));
  return (
    <View
      style={{
        padding: 14,
        borderBottomWidth: 1,
        borderColor: colors.line,
        gap: 10,
        backgroundColor: colors.white,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton
          name="arrow-left"
          label="Back to inbox"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/inbox")
          }
        />
        {member && <Avatar member={member} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Conversation participant"
          delayLongPress={800}
          onLongPress={() =>
            router.push({
              pathname: "/tools",
              params: { messageId: message.id },
            })
          }
          style={{ flex: 1, minWidth: 0, gap: 3 }}
        >
          <Text
            numberOfLines={1}
            accessibilityRole="header"
            style={styles.heading}
          >
            {member?.name ?? "Care team"}
          </Text>
          <Text numberOfLines={1} style={styles.small}>
            {isAI ? "Powered by Kimi" : `${space?.name} · ${member?.role}`}
          </Text>
        </Pressable>
        <IconButton
          name="more-horizontal"
          label="Conversation details"
          onPress={onShowDetails}
        />
      </View>
      {message.routing && (
        <Text style={styles.small}>
          Routed via{" "}
          {DEPARTMENTS.find((d) => d.id === message.routing?.department)
            ?.name ?? message.routing.department}{" "}
          · {message.routing.reason}
        </Text>
      )}
      <View style={[styles.spread, { paddingLeft: 6 }]}>
        <View style={styles.row}>
          <View
            style={{
              width: 7,
              height: 7,
              backgroundColor: colors.teal,
              borderRadius: 4,
            }}
          />
          <Text style={styles.small}>
            {isAI
              ? "AI teammate"
              : member?.userId
                ? "Team member"
                : "Care team communication"}
          </Text>
          <Badge label={message.priority} />
        </View>
        <View style={styles.row}>
          <IconButton
            name="phone"
            label="Start voice call"
            disabled={guided || busy || !member || isAI}
            onPress={() => {
              onCall("voice");
            }}
          />
          <IconButton
            name="video"
            label="Start video call"
            disabled={guided || busy || !member || isAI}
            onPress={() => {
              onCall("video");
            }}
          />
        </View>
      </View>
    </View>
  );
}
