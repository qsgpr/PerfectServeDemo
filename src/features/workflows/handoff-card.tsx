import { Text, View } from "react-native";
import { router } from "expo-router";
import { useCare } from "../../state/care-provider";
import { useWorkflows } from "../../state/workflow-provider";
import { Button, useUI } from "../../components/ui";
export function HandoffCard() {
  const { styles, colors } = useUI();
  const { data } = useCare();
  const { handoffs, loading, error, reload } = useWorkflows();
  const open =
    data?.messages.filter((m) => !m.resolvedAt)
      .length ?? 0;
  const pending = handoffs.filter((h) => h.status === "Pending").length;
  return (
    <View style={[styles.card, { backgroundColor: colors.tinted }]}>
      <Text style={styles.heading}>Shift handoff</Text>
      <Text style={styles.text}>
        {loading
          ? "Loading handoffs…"
          : `${open} open conversations · ${pending} handoffs awaiting acceptance`}
      </Text>
      {error ? (
        <>
          <Text accessibilityRole="alert" style={styles.text}>
            {error}
          </Text>
          <Button
            title="Retry handoffs"
            secondary
            onPress={() => void reload().catch(() => {})}
          />
        </>
      ) : (
        <Button
          title="View handoffs"
          secondary
          onPress={() => router.push("/handoffs")}
        />
      )}
      <Button
        title="Message a department"
        secondary
        onPress={() => router.push("/departments")}
      />
    </View>
  );
}
