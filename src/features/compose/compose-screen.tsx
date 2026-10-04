import {
  DEPARTMENTS,
  resolveDepartmentRoute,
  type DepartmentId,
} from "../../domain/workflows";
import { useWorkflows } from "../../state/workflow-provider";
import { RecipientPicker } from "./recipient-picker";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../auth/auth-provider";
import { useCare } from "../../state/care-provider";
import { coverage, searchTeam, validateDraft } from "../../data/care-service";
import { useSavedDraft } from "../../hooks/use-saved-draft";
import { Priority } from "../../domain/types";
import {
  Avatar,
  Button,
  DataGate,
  LoadingSkeleton,
  Page,
  useUI,
} from "../../components/ui";
import { Choice } from "../../components/choice";
export function Compose() {
  const { colors, styles } = useUI();
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    recipientId?: string;
    department?: string;
  }>();
  const { data, send, realNow, reload } = useCare();
  const workflow = useWorkflows();
  const department = DEPARTMENTS.find((d) => d.id === params.department);
  const { current, next } = coverage(data?.shifts ?? [], realNow);
  const currentMemberId = current?.memberId;
  const nextMemberId = next?.memberId;
  const saved = useSavedDraft(
    "shiftline.compose.v1",
    {
      recipientId: params.recipientId ?? "",
      body: "",
      priority: "Routine" as Priority,
    },
    (
      value,
    ): value is { recipientId: string; body: string; priority: Priority } =>
      !!value &&
      typeof value === "object" &&
      "recipientId" in value &&
      typeof value.recipientId === "string" &&
      "body" in value &&
      typeof value.body === "string" &&
      "priority" in value &&
      (value.priority === "Routine" || value.priority === "Urgent"),
  );
  const { body, priority } = saved.value;
  const routing = department
    ? resolveDepartmentRoute(
        data?.team ?? [],
        data?.shifts ?? [],
        workflow.reachability,
        department.id,
        priority,
        realNow,
        session?.id ?? "",
      )
    : null;
  const recipientId = department
    ? (routing?.recipient?.id ?? "")
    : (params.recipientId ?? saved.value.recipientId);
  const selectedRecipient = data?.team.find(
    (member) => member.id === recipientId,
  );
  const recipientLocked = Boolean(params.recipientId);
  const setRecipient = (id: string) => {
    router.setParams({ recipientId: id });
    saved.update({ recipientId: id });
  };
  const setBody = (body: string) => saved.update({ body, recipientId });
  const setPriority = (priority: Priority) =>
    saved.update({ priority, recipientId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState("");
  const matchingRecipients = searchTeam(
    (data?.team ?? []).filter((m) => m.userId !== session?.id || !m.userId),
    recipientQuery,
  );
  const prioritizedRecipients = [...matchingRecipients].sort((a, b) => {
    const rank = (id: string) =>
      id === currentMemberId ? 0 : id === nextMemberId ? 1 : 2;
    return rank(a.id) - rank(b.id);
  });
  const lock = useRef(false);
  const requestId = useRef<string | null>(null);
  const submit = async () => {
    if (lock.current) return;
    const draft = {
      recipientId,
      subject: body.trim().slice(0, 80),
      body,
      priority,
    };
    const validation =
      department && !routing?.recipient
        ? (routing?.reason ?? "No current coverage.")
        : !recipientId
          ? "Choose a recipient from your team."
          : !body.trim()
            ? "Write a message."
            : validateDraft(draft, data?.team ?? []);
    if (validation) {
      setError(validation);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      requestId.current ??= `draft-${Date.now()}-${Math.random()}`;
      const message = department
        ? await workflow.service.route(
            department.id as DepartmentId,
            draft,
            requestId.current,
          )
        : await send(draft, requestId.current);
      if (department) await reload();
      await saved.clear();
      router.replace({
        pathname: "/conversation",
        params: { messageId: message.id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send. Try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!saved.ready) return <LoadingSkeleton />;
  return (
    <DataGate>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={100}
      >
        <Page
          title="Start a conversation."
          subtitle="A small message can make a shift feel more connected."
        >
          <View style={styles.card}>
            {department ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>To {department.name}</Text>
                <Text style={styles.text}>
                  {routing?.recipient
                    ? `Routed to ${routing.recipient.name}`
                    : routing?.reason}
                </Text>
                <Text style={styles.small}>
                  {routing?.reason}. Coverage is checked again when you send.
                </Text>
                {!!workflow.error && (
                  <Text accessibilityRole="alert" style={styles.text}>
                    {workflow.error}
                  </Text>
                )}
              </View>
            ) : recipientLocked ? (
              <View
                accessibilityRole="text"
                accessibilityLabel={`Recipient ${selectedRecipient?.name ?? "team member"}`}
                style={[styles.row, { paddingBottom: 4 }]}
              >
                {selectedRecipient && <Avatar member={selectedRecipient} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.label}>To</Text>
                  <Text style={styles.text} numberOfLines={1}>
                    {selectedRecipient?.name ?? "Selected team member"}
                  </Text>
                  {!!selectedRecipient && (
                    <Text style={styles.small}>{selectedRecipient.role}</Text>
                  )}
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Recipient · required</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedRecipient
                      ? `Change recipient, ${selectedRecipient.name}`
                      : "Choose recipient"
                  }
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => {
                    setRecipientQuery("");
                    setRecipientPickerOpen(true);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 56,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: selectedRecipient ? colors.teal : colors.line,
                    backgroundColor: selectedRecipient
                      ? colors.accentSoft
                      : colors.white,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  {selectedRecipient ? (
                    <Avatar member={selectedRecipient} />
                  ) : (
                    <Feather name="user-plus" size={20} color={colors.teal} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.text} numberOfLines={1}>
                      {selectedRecipient?.name ?? "Choose a recipient"}
                    </Text>
                    <Text style={styles.small} numberOfLines={1}>
                      {selectedRecipient?.role ??
                        "Search by name, role, or specialty"}
                    </Text>
                  </View>
                  <Feather name="chevron-down" size={20} color={colors.teal} />
                </Pressable>
              </>
            )}
            <View>
              <Text style={styles.label}>Message · required</Text>
              <TextInput
                accessibilityLabel="Message"
                value={body}
                onChangeText={setBody}
                maxLength={2000}
                editable={!busy}
                multiline
                placeholder="Write a team update…"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  { minHeight: 150, textAlignVertical: "top" },
                ]}
              />
              <Text style={[styles.small, { marginTop: 6 }]}>
                {body.length}/2,000
              </Text>
            </View>
            <Text style={styles.label}>Priority</Text>
            <View style={styles.row}>
              {(["Routine", "Urgent"] as const).map((p) => (
                <Choice
                  key={p}
                  label={p}
                  selected={priority === p}
                  onPress={() => {
                    if (!busy) setPriority(p);
                  }}
                />
              ))}
            </View>
            <Text style={styles.small}>
              {priority === "Urgent"
                ? "Urgent messages can escalate after 15 seconds without a reply."
                : "Routine messages are for everyday team updates."}
            </Text>
            {!!saved.error && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {saved.error}
              </Text>
            )}
            {!!error && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{ color: colors.danger }}
              >
                {error}
              </Text>
            )}
            <Button
              title={busy ? "Starting conversation…" : "Start chat"}
              icon="send"
              disabled={
                busy || !!(department && (workflow.loading || workflow.error))
              }
              onPress={() => void submit()}
            />
          </View>
        </Page>
      </KeyboardAvoidingView>
      <RecipientPicker
        visible={recipientPickerOpen}
        members={prioritizedRecipients}
        recipientId={recipientId}
        query={recipientQuery}
        currentMemberId={currentMemberId}
        nextMemberId={nextMemberId}
        onQueryChange={setRecipientQuery}
        onClose={() => setRecipientPickerOpen(false)}
        onSelect={(id) => {
          setRecipient(id);
          setRecipientPickerOpen(false);
        }}
      />
    </DataGate>
  );
}
