import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";
import { useSavedDraft } from "../../hooks/use-saved-draft";
import { useCare } from "../../state/care-provider";
import { useChatTyping } from "./use-chat-typing";
import { pickChatPhoto } from "./photo-library";
import { AttachmentId, ChatInput, Message } from "../../domain/types";
export function useConversationComposer(
  message: Message,
  peerId: string | undefined,
  unread: string,
  guided: boolean,
  typing: ReturnType<typeof useChatTyping>,
  onSent: () => void,
) {
  const { post, act } = useCare();
  const inputRef = useRef<TextInput>(null);
  const lock = useRef(false);
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const saved = useSavedDraft(
    "shiftline.chat-draft." + message.id,
    { text: "", attachment: null as AttachmentId | null, imagePath: "" },
    (
      value,
    ): value is {
      text: string;
      attachment: AttachmentId | null;
      imagePath: string;
    } =>
      !!value &&
      typeof value === "object" &&
      "text" in value &&
      typeof value.text === "string" &&
      "attachment" in value &&
      (value.attachment === null ||
        value.attachment === "handoff-board" ||
        value.attachment === "team-map" ||
        (value.attachment === "device-photo" &&
          "imagePath" in value &&
          typeof value.imagePath === "string")),
  );
  const { text, attachment, imagePath = "" } = saved.value;
  const setText = (text: string) => saved.update({ text });
  const setAttachment = (attachment: AttachmentId | null) =>
    saved.update({ attachment, imagePath: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const readAction = useRef(act);
  useEffect(() => {
    readAction.current = act;
  }, [act]);
  useEffect(() => {
    if (!peerId || !unread || message.resolvedAt) return;
    void readAction
      .current(message.id, "read")
      .catch(() =>
        setError(
          "Read receipt could not be saved. Reopen this conversation to retry.",
        ),
      );
  }, [message.id, message.resolvedAt, peerId, unread]);

  const [call, setCall] = useState<"voice" | "video" | null>(null);
  const submit = async () => {
    if (lock.current || guided || message.resolvedAt) return;
    if (!text.trim() && !attachment) {
      setError("Write a message or attach an image.");
      return;
    }
    const value: ChatInput = attachment
      ? {
          kind: "image",
          attachmentId: attachment,
          imagePath: attachment === "device-photo" ? imagePath : undefined,
          text,
        }
      : { kind: "text", text };
    const signature = JSON.stringify(value);
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        key: "chat-" + Date.now() + "-" + Math.random(),
      };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      typing.stop();
      await post(message.id, value, pending.current!.key);
      await saved.clear();
      pending.current = null;
      onSent();
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const finishCall = async (
    duration: number,
    outcome: "completed" | "cancelled",
  ) => {
    const mode = call;
    setCall(null);
    if (!mode) return;
    try {
      await post(
        message.id,
        { kind: "call", mode, duration, outcome },
        "call-" + Date.now() + "-" + Math.random(),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save call.");
    }
  };
  const choosePhoto = (onClose: () => void) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    void pickChatPhoto(message.id)
      .then((path) => {
        if (path) {
          saved.update({
            attachment: "device-photo",
            imagePath: path,
          });
          onClose();
        }
      })
      .catch((e) => {
        setError(
          e instanceof Error ? e.message : "Could not open photo library.",
        );
        onClose();
      })
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };
  return {
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
    call,
    setCall,
    submit,
    finishCall,
    choosePhoto,
  };
}
