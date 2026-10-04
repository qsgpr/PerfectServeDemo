import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/auth-provider";
import { useCare } from "../../state/care-provider";
import { useWorkflows } from "../../state/workflow-provider";
import { Choice } from "../../components/choice";
import { Button, useUI } from "../../components/ui";
import {
  defaultReachability,
  parseTimeInput,
  timeInput,
  type Reachability,
} from "../../domain/workflows";
import { memberSpace } from "../../domain/chat";
import { RecipientPicker } from "../compose/recipient-picker";
export function ReachabilityPanel() {
  const w = useWorkflows();
  const { session } = useAuth();
  const { styles } = useUI();
  if (w.loading) return <Text style={styles.text}>Loading reachability…</Text>;
  if (w.error)
    return (
      <>
        <Text accessibilityRole="alert" style={styles.text}>
          {w.error}
        </Text>
        <Button
          title="Retry reachability"
          secondary
          onPress={() => void w.reload().catch(() => {})}
        />
      </>
    );
  return session ? (
    <ReachabilityForm
      key={session.id}
      initial={w.reachability[session.id] ?? defaultReachability(session.id)}
    />
  ) : null;
}
function ReachabilityForm({ initial }: { initial: Reachability }) {
  const { styles, colors } = useUI();
  const w = useWorkflows();
  const { data } = useCare();
  const { session } = useAuth();
  const [value, setValue] = useState(initial);
  const [start, setStart] = useState(timeInput(initial.quietStart));
  const [end, setEnd] = useState(timeInput(initial.quietEnd));
  const [picker, setPicker] = useState(false),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const lock = useRef(false);
  const department = memberSpace(data?.team.find((m) => m.id === session?.id));
  const candidates = (data?.team ?? []).filter(
    (m) =>
      m.id !== session?.id &&
      m.kind !== "ai" &&
      memberSpace(m) === department &&
      `${m.name} ${m.role}`.toLowerCase().includes(query.toLowerCase()),
  );
  const change = (patch: Partial<Reachability>) => {
    if (!busy) {
      setValue({ ...value, ...patch });
      setStatus("");
    }
  };
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus("");
    try {
      await w.service.settings({
        ...value,
        quietStart: parseTimeInput(start),
        quietEnd: parseTimeInput(end),
      });
      await w.reload();
      setStatus("Reachability saved.");
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : "Could not save reachability.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>
        How I’m reached
      </Text>
      <Text style={styles.small}>
        Availability controls department routing. Quiet hours use UTC; urgent
        messages bypass quiet hours and Busy, but never Offline.
      </Text>
      <Text style={styles.label}>Messaging availability</Text>
      <View style={styles.row}>
        {(["available", "busy", "offline"] as const).map((v) => (
          <Choice
            key={v}
            label={v[0].toUpperCase() + v.slice(1)}
            selected={value.availability === v}
            onPress={() => change({ availability: v })}
          />
        ))}
      </View>
      <Text style={styles.label}>Notification behavior</Text>
      <View style={styles.row}>
        {(
          [
            ["all", "All messages"],
            ["urgent", "Urgent only"],
            ["none", "No alerts"],
          ] as const
        ).map(([v, label]) => (
          <Choice
            key={v}
            label={label}
            selected={value.alerts === v}
            onPress={() => change({ alerts: v })}
          />
        ))}
      </View>
      <Text style={styles.small}>
        This changes foreground alerts and the push dispatcher. Messages still
        arrive in your inbox. Background push requires a signed app build.
      </Text>
      <Text style={styles.label}>
        Quiet hours · leave both blank to disable
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TextInput
          accessibilityLabel="Quiet hours start UTC"
          placeholder="22:00"
          placeholderTextColor={colors.muted}
          value={start}
          editable={!busy}
          onChangeText={(v) => {
            setStart(v);
            setStatus("");
          }}
          style={[styles.input, { flex: 1 }]}
          autoCorrect={false}
        />
        <TextInput
          accessibilityLabel="Quiet hours end UTC"
          placeholder="07:00"
          placeholderTextColor={colors.muted}
          value={end}
          editable={!busy}
          onChangeText={(v) => {
            setEnd(v);
            setStatus("");
          }}
          style={[styles.input, { flex: 1 }]}
          autoCorrect={false}
        />
      </View>
      <Text style={styles.label}>Designated backup</Text>
      <Text style={styles.text}>
        {data?.team.find((m) => m.id === value.backupId)?.name ??
          "Use the next shift’s teammate when reachable"}
      </Text>
      <Button
        title="Choose backup"
        secondary
        disabled={busy}
        onPress={() => setPicker(true)}
      />
      {value.backupId && (
        <Button
          title="Clear backup"
          secondary
          disabled={busy}
          onPress={() => change({ backupId: null })}
        />
      )}
      {!!status && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {status}
        </Text>
      )}
      <Button
        title={busy ? "Saving reachability…" : "Save reachability"}
        disabled={busy}
        onPress={() => void save()}
      />
      <RecipientPicker
        title="Choose a backup"
        visible={picker}
        members={candidates}
        recipientId={value.backupId ?? ""}
        query={query}
        onQueryChange={setQuery}
        onClose={() => setPicker(false)}
        onSelect={(id) => {
          change({ backupId: id });
          setPicker(false);
        }}
      />
    </View>
  );
}
