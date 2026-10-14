import { router } from "expo-router";
import { ReachabilityPanel } from "../workflows/reachability-panel";
import React, { useEffect, useState } from "react";
import {
  enableMessageAlerts,
  getMessageAlertStatus,
} from "../notifications/message-alerts";
import { Text } from "react-native";
import { useAuth } from "../auth/auth-provider";
import { PreferencesPanel } from "../presentation/demo-controls";
import { Button, Page, useUI } from "../../components/ui";
export default function Settings() {
  const { session, signOut, storageError } = useAuth();
  const { styles } = useUI();
  const [notificationStatus, setNotificationStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session)
      void getMessageAlertStatus(session.id)
        .then(setNotificationStatus)
        .catch(() =>
          setNotificationStatus("Unable to load notification preferences."),
        );
  }, [session]);
  return (
    <Page
      compact
      title="Your preferences"
      subtitle="Your account and appearance."
    >
      <Text style={styles.text}>{session?.email}</Text>
      {storageError && (
        <Text accessibilityRole="alert" style={styles.text}>
          {storageError}
        </Text>
      )}
      <Button
        title="Replay welcome tour"
        secondary
        onPress={() => router.push("/onboarding")}
      />
      <ReachabilityPanel />
      <PreferencesPanel playback={false} />
      <Text style={styles.heading}>Message notifications</Text>
      <Text accessibilityLiveRegion="polite" style={styles.text}>
        {notificationStatus}
      </Text>
      <Button
        title={
          busy ? "Enabling notifications…" : "Enable message notifications"
        }
        disabled={busy || !session}
        onPress={() => {
          if (!session || busy) return;
          setBusy(true);
          void enableMessageAlerts(session.id)
            .then(setNotificationStatus)
            .catch((e) =>
              setNotificationStatus(
                e instanceof Error ? e.message : "Could not enable alerts.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
      <Button title="Sign out" secondary onPress={signOut} />
    </Page>
  );
}
