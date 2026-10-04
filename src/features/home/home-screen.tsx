import { OnCallCard } from "./on-call-card";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { HandoffCard } from "../workflows/handoff-card";
import { useCare } from "../../state/care-provider";
import { coverage } from "../../data/care-service";
import {
  Button,
  DataGate,
  Empty,
  MessageCard,
  Page,
  useUI,
} from "../../components/ui";
export function Home() {
  const { colors, styles } = useUI();
  const { data, realNow } = useCare();
  const { current, next } = coverage(data?.shifts ?? [], realNow);
  const provider = data?.team.find((member) => member.id === current?.memberId);
  const nextProvider = data?.team.find(
    (member) => member.id === next?.memberId,
  );
  const recent = data?.messages.filter((m) => !m.resolvedAt) ?? [];
  const date = new Date(realNow).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <DataGate>
      <Page
        title="Today"
        subtitle={date}
        action={
          <Button
            title="New message"
            icon="plus"
            onPress={() => router.push("/compose")}
          />
        }
      >
        <OnCallCard
          provider={provider}
          nextProvider={nextProvider}
          current={current}
          next={next}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Text style={[styles.heading, { flex: 1, minWidth: 0 }]}>
            Recent conversations
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all conversations"
            onPress={() => router.push("/inbox")}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: 8,
            }}
          >
            <Text style={{ color: colors.teal, fontWeight: "600" }}>
              View all
            </Text>
          </Pressable>
        </View>
        {recent.length ? (
          recent.slice(0, 3).map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              member={data?.team.find(
                (member) => member.id === message.recipientId,
              )}
              onPress={() =>
                router.push({
                  pathname: "/conversation",
                  params: { messageId: message.id },
                })
              }
            />
          ))
        ) : (
          <Empty
            title="No conversations yet"
            detail="Start a conversation with your team."
          />
        )}
        <HandoffCard />
      </Page>
    </DataGate>
  );
}
