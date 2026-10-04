import { useConversationComposer } from "./use-conversation-composer";
import { Platform, Text, TextInput, View } from "react-native";
import { Message } from "../../domain/types";
import { Button, useUI } from "../../components/ui";
import { CHAT_IMAGES, SharedImage } from "./shared-image";
import { IconButton } from "../../components/icon-button";
import type { SimulationState } from "../presentation/simulation";
import type { useChatTyping } from "./use-chat-typing";
export function ConversationComposer({
  controller,
  message,
  guided,
  thinking,
  isAI,
  state,
  typing,
  onAttach,
  onRetryAI,
}: {
  controller: ReturnType<typeof useConversationComposer>;
  message: Message;
  guided: boolean;
  thinking: boolean;
  isAI: boolean;
  state?: SimulationState;
  typing: ReturnType<typeof useChatTyping>;
  onAttach: () => void;
  onRetryAI: () => void;
}) {
  const { colors, styles } = useUI();
  const {
    saved,
    text,
    attachment,
    imagePath,
    setText,
    setAttachment,
    busy,
    error,
    setError,
    inputRef,
    submit,
  } = controller;
  const sendFromKeyboard = () => {
    if (
      !saved.ready ||
      busy ||
      guided ||
      thinking ||
      (!text.trim() && !attachment)
    )
      return;
    void submit();
  };
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderColor: colors.line,
        padding: 14,
        gap: 10,
      }}
    >
      {isAI &&
        (state?.phase === "error" ||
          state?.phase === "stopped" ||
          (!state && message.status !== "Replied")) && (
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {state?.error ?? "AI reply paused. Retry when you are ready."}
            </Text>
            <Button title="Retry AI reply" secondary onPress={onRetryAI} />
          </View>
        )}
      {!!saved.error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {saved.error}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      )}
      {attachment && (
        <View style={styles.spread}>
          <View style={{ width: 160 }}>
            <SharedImage id={attachment} path={imagePath} height={88} />
          </View>
          <Text style={[styles.small, { flex: 1 }]}>
            {attachment === "device-photo"
              ? "Photo from your library"
              : CHAT_IMAGES.find((a) => a.id === attachment)?.title}
          </Text>
          <IconButton
            name="x"
            label="Remove attachment"
            disabled={busy}
            onPress={() => setAttachment(null)}
          />
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <IconButton
          name="plus"
          label="Attach image"
          disabled={busy || guided || thinking}
          onPress={onAttach}
        />
        <TextInput
          ref={inputRef}
          accessibilityLabel="Chat message"
          value={text}
          onChangeText={(value) => {
            setText(value);
            typing.activity(!!value.trim());
            setError("");
          }}
          onBlur={typing.stop}
          multiline
          returnKeyType="send"
          submitBehavior={Platform.OS === "web" ? undefined : "submit"}
          onSubmitEditing={sendFromKeyboard}
          onKeyPress={
            Platform.OS === "web"
              ? (event) => {
                  const key = event.nativeEvent as typeof event.nativeEvent & {
                    shiftKey?: boolean;
                    isComposing?: boolean;
                    keyCode?: number;
                  };
                  if (
                    key.key === "Enter" &&
                    !key.shiftKey &&
                    !key.isComposing &&
                    key.keyCode !== 229
                  ) {
                    event.preventDefault();
                    sendFromKeyboard();
                  }
                }
              : undefined
          }
          maxLength={2000}
          editable={saved.ready && !busy && !guided && !thinking}
          placeholder="Message your teammate…"
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            minHeight: 46,
            maxHeight: 120,
            borderRadius: 18,
            backgroundColor: colors.soft,
            paddingHorizontal: 16,
            paddingVertical: 13,
            color: colors.ink,
            fontSize: 16,
            textAlignVertical: "top",
          }}
        />
        <IconButton
          name="send"
          label={busy ? "Sending chat message" : "Send chat message"}
          disabled={busy || guided || thinking || (!text.trim() && !attachment)}
          onPress={() => void submit()}
        />
      </View>
      <View style={styles.spread}>
        <Text style={styles.small}>
          {text.length ? text.length + "/2,000" : "Text, images, voice & video"}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.small}>
          {busy
            ? "Sending…"
            : message.status === "Replied"
              ? "Reply received"
              : message.status}
        </Text>
      </View>
    </View>
  );
}
