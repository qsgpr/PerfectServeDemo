import {
  ConversationControls,
  ResolvedConversation,
} from "./conversation-controls";
import { useConversationComposer } from "./use-conversation-composer";
import { ConversationComposer } from "./conversation-composer";
import { ConversationDetails } from "./conversation-details";
import { ConversationHeader } from "./conversation-header";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCare } from "../../state/care-provider";
import { useChatTyping } from "./use-chat-typing";
import { chatEntries } from "../../domain/chat";
import { AttachmentId, Message, TeamMember } from "../../domain/types";
import { Button, useUI } from "../../components/ui";
import { CHAT_IMAGES, SharedImage } from "./shared-image";
import { CallSession } from "./call-session";
import { Sheet } from "../../components/sheet";
import { Bubble } from "./message-bubble";
import { TypingBubble } from "./typing-bubble";
export function ConversationThread({
  message,
  member,
}: {
  message: Message;
  member?: TeamMember;
}) {
  const { colors, styles, feedback } = useUI();
  const { simulations, tour, retryAI } = useCare();
  const guided = tour.status === "running" && tour.messageId === message.id;
  const entries = chatEntries(message);
  const typing = useChatTyping(message.id, member?.userId);
  const state = simulations[message.id];
  const isAI = member?.kind === "ai";
  const thinking = isAI && state?.phase === "typing";
  const unread = entries
    .filter(
      (entry) =>
        entry.sender === "teammate" &&
        entry.kind !== "call" &&
        entry.status === "Sent",
    )
    .map((entry) => entry.id)
    .join(",");
  const scroll = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const composer = useConversationComposer(
    message,
    member?.userId,
    unread,
    guided,
    typing,
    () => {
      nearBottom.current = true;
    },
  );
  const { busy, choosePhoto, setAttachment, call, setCall, finishCall } =
    composer;
  const [resolving, setResolving] = useState(false);
  const [panel, setPanel] = useState<"attachments" | "tools" | null>(null);
  const [image, setImage] = useState<{
    id: AttachmentId;
    path?: string;
  } | null>(null);
  useEffect(() => {
    if (nearBottom.current) scroll.current?.scrollToEnd({ animated: false });
  }, [entries.length, state?.phase, typing.peerTyping]);
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: colors.white }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 1000,
            alignSelf: "center",
            backgroundColor: colors.paper,
          }}
        >
          <ConversationHeader
            message={message}
            member={member}
            guided={guided}
            busy={busy || resolving || !!message.resolvedAt}
            onShowDetails={() => setPanel("tools")}
            onCall={(mode) => {
              feedback();
              setCall(mode);
            }}
          />
          <ConversationControls
            message={message}
            isAI={isAI}
            disabled={busy || guided}
            onPending={setResolving}
          />
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={100}
            onScroll={(event) => {
              const { layoutMeasurement, contentOffset, contentSize } =
                event.nativeEvent;
              nearBottom.current =
                layoutMeasurement.height + contentOffset.y >=
                contentSize.height - 120;
            }}
            onContentSizeChange={() => {
              if (nearBottom.current)
                scroll.current?.scrollToEnd({ animated: false });
            }}
            contentContainerStyle={{ padding: 18, paddingBottom: 26, gap: 18 }}
          >
            <View
              style={{
                alignSelf: "center",
                alignItems: "center",
                gap: 8,
                marginVertical: 6,
              }}
            >
              <Text style={styles.small}>
                {new Date(message.createdAt).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </Text>
              <Text
                accessibilityRole="header"
                style={[styles.small, { fontWeight: "600" }]}
              >
                {message.subject}
              </Text>
            </View>
            {entries.map((entry) => (
              <Bubble
                key={entry.id}
                entry={entry}
                member={member}
                preview={(id, path) => setImage({ id, path })}
              />
            ))}
            {message.events
              .filter((e) => e.type === "Escalated")
              .map((event) => (
                <Text
                  key={event.id}
                  style={[
                    styles.small,
                    { alignSelf: "center", textAlign: "center" },
                  ]}
                >
                  {event.text}
                </Text>
              ))}
            {!message.resolvedAt &&
              (typing.peerTyping || state?.phase === "typing") && (
                <TypingBubble
                  label={
                    isAI ? "Nova is thinking…" : "Your teammate is typing…"
                  }
                />
              )}
            {state?.phase === "countdown" && (
              <Text
                accessibilityRole="timer"
                style={[
                  styles.small,
                  { color: colors.urgentInk, alignSelf: "center" },
                ]}
              >
                {state.remaining}s until escalation
              </Text>
            )}
          </ScrollView>
          {message.resolvedAt ? (
            <ResolvedConversation message={message} />
          ) : (
            <ConversationComposer
              controller={composer}
              message={message}
              guided={guided || resolving}
              thinking={thinking}
              isAI={isAI}
              state={state}
              typing={typing}
              onAttach={() => setPanel("attachments")}
              onRetryAI={() => retryAI(message.id)}
            />
          )}
        </View>
      </KeyboardAvoidingView>
      {panel === "attachments" && (
        <Sheet title="Share an image" close={() => setPanel(null)}>
          <Button
            title={
              busy ? "Opening photo library…" : "Choose from photo library"
            }
            icon="image"
            disabled={busy}
            onPress={() => {
              choosePhoto(() => setPanel(null));
            }}
          />
          {CHAT_IMAGES.map((asset) => (
            <Pressable
              key={asset.id}
              accessibilityRole="button"
              accessibilityLabel={"Attach " + asset.title}
              onPress={() => {
                setAttachment(asset.id);
                setPanel(null);
              }}
              style={[styles.card, { padding: 12 }]}
            >
              <SharedImage id={asset.id} height={150} />
              <Text style={styles.heading}>{asset.title}</Text>
              <Text style={styles.small}>{asset.subtitle}</Text>
            </Pressable>
          ))}
        </Sheet>
      )}
      {image && (
        <Sheet
          title={
            image.id === "device-photo"
              ? "Shared photo"
              : CHAT_IMAGES.find((a) => a.id === image.id)!.title
          }
          close={() => setImage(null)}
        >
          <SharedImage id={image.id} path={image.path} height={300} />
        </Sheet>
      )}
      {panel === "tools" && (
        <ConversationDetails
          message={message}
          member={member}
          onClose={() => setPanel(null)}
        />
      )}
      {call && member && !message.resolvedAt && (
        <CallSession
          mode={call}
          member={member}
          onFinish={(duration, outcome) => void finishCall(duration, outcome)}
        />
      )}
    </SafeAreaView>
  );
}
