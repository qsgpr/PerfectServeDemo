import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import { useTheme } from "../../theme/theme-provider";
import { useAuth } from "./auth-provider";
import { DEMO_ACCOUNT, validateLogin } from "./auth-service";
import { perfectServeLogo } from "../../components/logo";
const lightPalette = {
  ink: "#101B15",
  green: "#005A50",
  plum: "#681338",
  orchid: "#F6B7FA",
  linen: "#F6F2EE",
  muted: "#58665D",
};
export default function Login() {
  const { colors, dark, update } = useTheme();
  const palette = useMemo(
    () => ({
      ...lightPalette,
      ink: colors.ink,
      green: colors.teal,
      plum: colors.plum,
      linen: colors.linen,
      muted: colors.muted,
      surface: colors.white,
      soft: colors.soft,
      line: colors.line,
      accent: colors.accentSoft,
      onAccent: colors.onAccent,
      danger: colors.danger,
    }),
    [colors],
  );
  const s = useMemo(() => makeStyles(palette), [palette]);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { signIn, signUp, cloud, storageError } = useAuth();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const passwordInput = useRef<TextInput>(null);
  const submit = async () => {
    if (lock.current) return;
    const validation = validateLogin(email, password);
    if (validation) {
      setError(validation);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (creating) {
        const signedIn = await signUp(email, password, name);
        if (!signedIn) {
          setNotice("Check your email to confirm your account, then sign in.");
          setCreating(false);
        }
      } else await signIn(email, password);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.page, { padding: wide ? 36 : 22 }]}
        >
          <View style={s.header}>
            <SvgXml
              xml={
                dark
                  ? perfectServeLogo.replace(/#101B15/gi, "#E5F0ED")
                  : perfectServeLogo
              }
              width={205}
              height={38}
              accessibilityRole="image"
              accessibilityLabel="PerfectServe"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
              onPress={() => update({ mode: dark ? "light" : "dark" })}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather
                name={dark ? "sun" : "moon"}
                size={21}
                color={palette.green}
              />
            </Pressable>
          </View>
          <View
            style={[
              s.main,
              { flexDirection: wide ? "row" : "column", gap: wide ? 64 : 32 },
            ]}
          >
            {wide && (
              <View style={s.story}>
                <Text style={s.kicker}>CARE TEAM COMMUNICATION</Text>
                <Text style={s.storyTitle}>
                  A connected team.{"\n"}A clearer day.
                </Text>
                <Text style={s.storyBody}>
                  Find the right teammate, see who’s covering, and keep every
                  conversation moving.
                </Text>
                <View accessible={false} style={s.illustration}>
                  <View style={s.orbitOuter} />
                  <View style={s.orbitInner} />
                  <View
                    style={[
                      s.previewCard,
                      { marginTop: 42, alignSelf: "flex-start" },
                    ]}
                  >
                    <View style={s.avatar}>
                      <Text style={{ color: "#005A50", fontWeight: "700" }}>
                        MV
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>Mira Vale</Text>
                      <Text style={s.cardSmall}>On-call provider</Text>
                    </View>
                    <View style={s.dot} />
                  </View>
                  <View
                    style={[
                      s.previewCard,
                      { alignSelf: "flex-end", marginTop: 18, width: "88%" },
                    ]}
                  >
                    <Feather
                      name="message-circle"
                      size={22}
                      color={palette.plum}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>Your team is in the loop</Text>
                      <Text style={s.cardSmall}>
                        Team update · Reply received
                      </Text>
                    </View>
                    <Feather
                      name="check-circle"
                      size={19}
                      color={palette.green}
                    />
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Feather name="users" size={18} color={palette.green} />
                  <Text style={s.cardSmall}>Your team. Connected.</Text>
                </View>
              </View>
            )}
            <View style={[s.form, { padding: wide ? 40 : 24 }]}>
              <Text style={s.kicker}>WELCOME TO SHIFTLINE</Text>
              <Text accessibilityRole="header" style={s.title}>
                {creating ? "Join your team." : "Welcome back."}
              </Text>
              <Text style={s.description}>
                Sign in to connect with your care team.
              </Text>

              {creating && (
                <View>
                  <Text style={s.label}>Name</Text>
                  <TextInput
                    accessibilityLabel="Your name"
                    value={name}
                    onChangeText={setName}
                    style={s.input}
                    editable={!busy}
                    placeholder="Your name"
                    placeholderTextColor={palette.muted}
                  />
                </View>
              )}
              {!!notice && (
                <Text accessibilityLiveRegion="polite" style={s.description}>
                  {notice}
                </Text>
              )}
              {!!storageError && (
                <Text accessibilityRole="alert" style={s.error}>
                  {storageError}
                </Text>
              )}
              <View>
                <Text style={s.label}>Email</Text>
                <TextInput
                  accessibilityLabel="Email"
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={
                    cloud ? "you@example.com" : "alex@shiftline.example"
                  }
                  placeholderTextColor="#6A746D"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                  editable={!busy}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInput.current?.focus()}
                />
              </View>
              <View>
                <Text style={s.label}>Password</Text>
                <View style={s.passwordRow}>
                  <TextInput
                    ref={passwordInput}
                    accessibilityLabel="Password"
                    style={[s.input, { borderWidth: 0, flex: 1, minWidth: 0 }]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!visible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    textContentType="none"
                    editable={!busy}
                    placeholder="Enter your password"
                    placeholderTextColor="#6A746D"
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      visible ? "Hide password" : "Show password"
                    }
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => setVisible((v) => !v)}
                    style={s.eye}
                  >
                    <Feather
                      name={visible ? "eye-off" : "eye"}
                      color={palette.muted}
                      size={20}
                    />
                  </Pressable>
                </View>
              </View>
              {!!error && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  style={s.error}
                >
                  {error}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={creating ? "Create account" : "Sign in"}
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  s.submit,
                  { opacity: busy || pressed ? 0.7 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={palette.onAccent} />
                ) : (
                  <>
                    <Text style={s.submitText}>
                      {creating ? "Create account" : "Sign in"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={19}
                      color={palette.onAccent}
                    />
                  </>
                )}
              </Pressable>
              {cloud && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setCreating(!creating);
                    setError("");
                    setNotice("");
                  }}
                  style={s.fillButton}
                >
                  <Text
                    style={{
                      color: palette.green,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    {creating
                      ? "Already have an account? Sign in"
                      : "Create an account"}
                  </Text>
                </Pressable>
              )}
              {!cloud && (
                <View style={s.credentials}>
                  <View style={s.credentialHeader}>
                    <Text style={s.credentialTitle}>Your account</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => {
                        setEmail(DEMO_ACCOUNT.email);
                        setPassword(DEMO_ACCOUNT.password);
                        setError("");
                      }}
                      style={s.fillButton}
                    >
                      <Text
                        style={{
                          color: palette.plum,
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        Use this account
                      </Text>
                    </Pressable>
                  </View>
                  <Text selectable style={s.credentialText}>
                    {DEMO_ACCOUNT.email}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.footer}>
            <Text style={s.footerText}>
              Shiftline · Care team communication
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
type LoginPalette = typeof lightPalette & {
  surface: string;
  soft: string;
  line: string;
  accent: string;
  onAccent: string;
  danger: string;
};
const makeStyles = (palette: LoginPalette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.linen },
    page: {
      flexGrow: 1,
      gap: 36,
      width: "100%",
      maxWidth: 1440,
      alignSelf: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
      flexWrap: "wrap",
    },
    demoTag: {
      borderWidth: 1,
      borderColor: "#D6CBCF",
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 5,
    },
    demoTagText: {
      color: palette.plum,
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: "700",
    },
    main: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
    },
    story: { flex: 1, maxWidth: 530, gap: 24 },
    kicker: {
      color: palette.green,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.8,
    },
    storyTitle: {
      fontFamily: Platform.select({
        ios: "Georgia",
        android: "serif",
        default: "Georgia",
      }),
      fontSize: 56,
      lineHeight: 62,
      color: palette.ink,
      letterSpacing: -1.8,
    },
    storyBody: {
      color: palette.muted,
      fontSize: 18,
      lineHeight: 28,
      maxWidth: 400,
    },
    illustration: {
      height: 230,
      justifyContent: "center",
      overflow: "hidden",
      paddingHorizontal: 10,
    },
    orbitOuter: {
      position: "absolute",
      width: 240,
      height: 240,
      borderRadius: 120,
      borderWidth: 1,
      borderColor: "#CEBCBF",
      right: 26,
      top: 0,
    },
    orbitInner: {
      position: "absolute",
      width: 166,
      height: 166,
      borderRadius: 83,
      backgroundColor: palette.accent,
      right: 63,
      top: 37,
    },
    previewCard: {
      width: "90%",
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 18,
      backgroundColor: palette.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.line,
    },
    avatar: {
      width: 44,
      height: 44,
      backgroundColor: "#DDECE5",
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: palette.green,
    },
    cardTitle: { color: palette.ink, fontSize: 14, fontWeight: "600" },
    cardSmall: { color: palette.muted, fontSize: 12, lineHeight: 20 },
    form: {
      width: "100%",
      maxWidth: 480,
      backgroundColor: palette.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: palette.line,
      gap: 21,
    },
    title: {
      fontFamily: Platform.select({
        ios: "Georgia",
        android: "serif",
        default: "Georgia",
      }),
      fontSize: 39,
      color: palette.ink,
      letterSpacing: -1,
      marginBottom: -12,
    },
    description: { fontSize: 15, lineHeight: 22, color: palette.muted },
    notice: {
      flexDirection: "row",
      gap: 9,
      backgroundColor: palette.soft,
      borderRadius: 8,
      padding: 12,
    },
    noticeText: { flex: 1, fontSize: 12, lineHeight: 19, color: palette.plum },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: palette.ink,
      marginBottom: 9,
    },
    input: {
      borderWidth: 1,
      borderColor: "#A4AEA7",
      borderRadius: 8,
      minHeight: 52,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 16,
      color: palette.ink,
      backgroundColor: palette.surface,
    },
    passwordRow: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: "#A4AEA7",
      borderRadius: 8,
      alignItems: "center",
      overflow: "hidden",
    },
    eye: {
      minWidth: 48,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    error: { color: palette.danger, fontSize: 13, lineHeight: 20 },
    submit: {
      minHeight: 54,
      borderRadius: 8,
      backgroundColor: palette.plum,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    submitText: { color: palette.onAccent, fontWeight: "600", fontSize: 16 },
    credentials: {
      padding: 14,
      borderRadius: 10,
      backgroundColor: palette.soft,
      gap: 5,
    },
    credentialHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
    },
    credentialTitle: { color: palette.ink, fontWeight: "600", fontSize: 13 },
    fillButton: { minHeight: 44, justifyContent: "center" },
    credentialText: { color: palette.muted, fontSize: 12, lineHeight: 19 },
    localNote: {
      color: palette.muted,
      fontSize: 11,
      lineHeight: 18,
      textAlign: "center",
    },
    footer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 10,
    },
    footerText: { color: palette.muted, fontSize: 11, lineHeight: 18 },
  });
