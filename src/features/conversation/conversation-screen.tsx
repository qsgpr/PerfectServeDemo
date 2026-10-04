import { router, useLocalSearchParams } from "expo-router";
import { useCare } from "../../state/care-provider";
import { Button, DataGate, Empty, Page } from "../../components/ui";
import { ConversationThread } from "./conversation-thread";
export function ChatConversation() {
  const params = useLocalSearchParams<{ messageId?: string }>();
  const { data } = useCare();
  const message = data?.messages.find((m) => m.id === params.messageId);
  const member = data?.team.find((m) => m.id === message?.recipientId);
  return (
    <DataGate>
      {message ? (
        <ConversationThread
          key={message.id}
          message={message}
          member={member}
        />
      ) : (
        <Page
          title="Conversation not found"
          subtitle="This conversation is no longer available."
        >
          <Empty
            title="Start again from your inbox"
            detail="Select a saved conversation from Inbox."
          />
          <Button title="Open Inbox" onPress={() => router.replace("/inbox")} />
        </Page>
      )}
    </DataGate>
  );
}
