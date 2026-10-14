import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useNavigation } from "expo-router";
import type { NavigationProp } from "@react-navigation/native";
import { Button, Page, useUI } from "../../components/ui";
import { supabase } from "../../data/supabase";
import { useAuth } from "./auth-provider";
import {
  acceptRecoveryLink,
  parseRecoveryLink,
  validateNewPassword,
} from "./password-recovery";

export default function ResetPassword() {
  const { colors, styles } = useUI();
  const { recoverySession, finishRecovery } = useAuth();
  const navigation =
    useNavigation<
      NavigationProp<
        { "reset-password": Record<string, string | undefined> },
        "reset-password"
      >
    >();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const verification = useRef<Promise<void> | null>(null);
  const link = useMemo(() => {
    try {
      if (Platform.OS !== "web")
        throw new Error("Open the reset link in your browser.");
      const recoveryWindow = window as Window & {
        __SHIFTLINE_RECOVERY_LINK__?: string;
      };
      return {
        value: parseRecoveryLink(
          recoveryWindow.__SHIFTLINE_RECOVERY_LINK__ ?? window.location.href,
        ),
        error: "",
      };
    } catch (e) {
      return {
        value: null,
        error: e instanceof Error ? e.message : "Invalid reset link.",
      };
    }
  }, []);
  useEffect(() => {
    let active = true;
    let cleanupFrame: number | undefined;
    // Remove credentials from browser history before requesting anything else.
    if (Platform.OS === "web") {
      delete (window as Window & { __SHIFTLINE_RECOVERY_LINK__?: string })
        .__SHIFTLINE_RECOVERY_LINK__;
      window.history.replaceState(window.history.state, "", "/reset-password");
      // The navigation container finishes its initial URL sync after child effects.
      // Clear its parameters after that sync so it cannot restore the credentials.
      cleanupFrame = requestAnimationFrame(() => {
        window.history.replaceState(
          window.history.state,
          "",
          "/reset-password",
        );
        navigation.setParams({
          "#": "",
          code: undefined,
          token_hash: undefined,
          type: undefined,
          error: undefined,
          error_description: undefined,
        });
      });
    }
    if (link.value && supabase) {
      verification.current ??= acceptRecoveryLink(supabase.auth, link.value);
      void verification.current
        .then(() => {
          if (active) setReady(true);
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error
                ? e.message
                : "Could not verify the reset link.",
            );
        });
    }
    return () => {
      active = false;
      if (cleanupFrame !== undefined) cancelAnimationFrame(cleanupFrame);
    };
  }, [link, navigation]);
  const displayedError =
    error ||
    (recoverySession ? "" : link.error) ||
    (!supabase ? "Password recovery requires a configured backend." : "");
  async function save() {
    if (lock.current || !(ready || recoverySession) || !supabase || saved)
      return;
    const validation = validateNewPassword(password, confirmation);
    if (validation) {
      setError(validation);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not update your password. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page
        title={saved ? "Password updated" : "Choose a new password"}
        subtitle={
          saved
            ? "Your new password is ready to use."
            : "Use at least eight characters."
        }
      >
        <View
          style={[
            styles.card,
            { width: "100%", maxWidth: 480, alignSelf: "center" },
          ]}
        >
          {!saved && (ready || recoverySession) && (
            <>
              <Text style={styles.label}>New password</Text>
              <TextInput
                accessibilityLabel="New password"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                maxLength={128}
                editable={!busy}
              />
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                accessibilityLabel="Confirm new password"
                style={styles.input}
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                maxLength={128}
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={() => void save()}
              />
              <Button
                title={busy ? "Updating password…" : "Update password"}
                disabled={busy}
                onPress={() => void save()}
              />
            </>
          )}
          {!(ready || recoverySession) && !displayedError && (
            <Text style={styles.text}>Verifying your reset link…</Text>
          )}
          {!!displayedError && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.text, { color: colors.danger }]}
            >
              {displayedError}
            </Text>
          )}
          <Button
            title={saved ? "Sign in with new password" : "Back to sign in"}
            disabled={busy}
            secondary
            onPress={() => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              void finishRecovery()
                .then(() => router.replace("/login"))
                .catch(() => {
                  setError(
                    "Could not end password recovery. Please try again.",
                  );
                })
                .finally(() => {
                  lock.current = false;
                  setBusy(false);
                });
            }}
          />
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
