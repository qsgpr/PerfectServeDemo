import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCare } from "../../state/care-provider";
import { useWorkflows } from "../../state/workflow-provider";
import { useAuth } from "../auth/auth-provider";
import {
  Avatar,
  Button,
  DataGate,
  Empty,
  Page,
  time,
  useUI,
  PresenceLabel,
} from "../../components/ui";
import {
  DEPARTMENTS,
  defaultReachability,
  timeInput,
} from "../../domain/workflows";
import { memberSpace } from "../../domain/chat";
export default function Contact() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { data, realNow } = useCare();
  const w = useWorkflows();
  const { session } = useAuth();
  const { styles } = useUI();
  const member = data?.team.find((m) => m.id === memberId);
  if (!member)
    return (
      <DataGate>
        <Page title="Contact">
          <Empty
            title="Contact unavailable"
            detail="Return to Directory and choose a teammate."
          />
        </Page>
      </DataGate>
    );
  const preferences =
    w.reachability[member.id] ?? defaultReachability(member.id);
  const next = data?.shifts
    .filter(
      (s) =>
        s.memberId === member.id &&
        s.department &&
        Date.parse(s.start) > Date.parse(realNow),
    )
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return (
    <DataGate>
      <Page title={member.name} subtitle={member.role}>
        <View style={styles.card}>
          <Avatar member={member} large />
          <Text style={styles.heading}>
            {DEPARTMENTS.find((d) => d.id === memberSpace(member))?.name ??
              "AI teammate"}
          </Text>
          <Text style={styles.text}>{member.specialty}</Text>
          <PresenceLabel presence={member.presence} />
          <Text style={styles.text}>
            Messaging availability: {preferences.availability}
          </Text>
          <Text style={styles.small}>
            {preferences.quietStart === null
              ? "No quiet hours"
              : `Quiet hours ${timeInput(preferences.quietStart)}–${timeInput(preferences.quietEnd)} UTC`}
          </Text>
          <Text style={styles.small}>
            Backup:{" "}
            {data?.team.find((m) => m.id === preferences.backupId)?.name ??
              "Next shift when reachable"}
          </Text>
          <Text style={styles.text}>
            {member.kind === "ai"
              ? "Available as an AI assistant"
              : next
                ? `Next shift: ${new Date(next.start).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} · ${time(next.start)} UTC`
                : "No upcoming shift"}
          </Text>
          {member.id !== session?.id && (
            <Button
              title={`Message ${member.name.split(" ")[0]}`}
              onPress={() =>
                router.push({
                  pathname: "/compose",
                  params: { recipientId: member.id },
                })
              }
            />
          )}
          <Text style={styles.small}>
            Voice and video controls are available in the conversation.
          </Text>
        </View>
      </Page>
    </DataGate>
  );
}
