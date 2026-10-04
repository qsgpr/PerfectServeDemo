import { Text, View } from "react-native";
import { Message, TeamMember } from "../../domain/types";
import { time, useUI, PresenceLabel } from "../../components/ui";
import { Sheet } from "../../components/sheet";
export function ConversationDetails({
  message,
  member,
  onClose,
}: {
  message: Message;
  member?: TeamMember;
  onClose: () => void;
}) {
  const { colors, styles } = useUI();
  return (
    <Sheet title="Conversation details" close={onClose}>
      <Text style={styles.heading}>{message.subject}</Text>
      <Text style={styles.text}>
        {member?.name} · {member?.role}
      </Text>
      {member?.kind === "ai" && (
        <View
          style={[styles.card, { backgroundColor: colors.tinted, padding: 14 }]}
        >
          <Text style={styles.text}>Nova · Team coordination assistant</Text>
          <Text style={styles.small}>
            Helps organize fictional team updates and explain general health
            topics. Nova does not diagnose, prescribe, or replace a qualified
            professional.
          </Text>
        </View>
      )}
      <Text style={styles.small}>
        Priority · {message.priority} / Status ·{" "}
        {message.resolvedAt ? "Resolved" : message.status}
      </Text>
      <PresenceLabel presence={member?.presence} />
      <Text style={styles.heading}>Activity timeline</Text>
      {message.events.map((event) => (
        <View key={event.id} style={{ gap: 4 }}>
          <Text style={styles.text}>{event.text}</Text>
          <Text style={styles.small}>
            {time(event.at)} · {event.type}
          </Text>
        </View>
      ))}
      <Text style={styles.heading}>Escalation path</Text>
      <View style={{ gap: 8 }}>
        <Text style={styles.text}>1. {member?.name ?? "Primary teammate"}</Text>
        <Text style={styles.text}>2. On-call backup team</Text>
        <Text style={styles.text}>3. Charge coordinator</Text>
      </View>
    </Sheet>
  );
}
