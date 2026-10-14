import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Avatar, Button, Page, useUI } from "../../components/ui";
import { useAuth } from "../auth/auth-provider";
import { team } from "../../data/fixtures";
import { ONBOARDING_STEPS } from "./onboarding-model";

export default function Onboarding() {
  const { colors, styles } = useUI();
  const { session, completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const current = ONBOARDING_STEPS[step];
  const last = step === ONBOARDING_STEPS.length - 1;
  async function finish() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await completeOnboarding();
      router.replace("/");
    } catch {
      setError("Could not save your tour preference. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <Page
        title="Welcome"
        compact
        action={
          <Button
            title="Skip tour"
            secondary
            disabled={busy}
            onPress={() => void finish()}
          />
        }
        subtitle={
          step === 0
            ? `Hi ${session?.name.split(" ")[0] ?? "there"}. Let’s get you oriented.`
            : "A few useful things to know."
        }
      >
        <View
          style={{ width: "100%", maxWidth: 600, alignSelf: "center", gap: 20 }}
        >
          <View style={[styles.card, { padding: 24, gap: 24 }]}>
            <View
              style={{
                minHeight: 210,
                padding: 20,
                borderRadius: 18,
                backgroundColor: colors.soft,
                justifyContent: "center",
                gap: 16,
              }}
            >
              {step === 1 ? (
                <View style={{ gap: 14 }}>
                  {[team[1], team[2], team[3]].map((member) => (
                    <View
                      key={member.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Avatar member={member} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.text, { fontWeight: "600" }]}>
                          {member.name}
                        </Text>
                        <Text style={styles.small}>{member.role}</Text>
                      </View>
                      <Feather
                        name="message-circle"
                        size={20}
                        color={colors.teal}
                      />
                    </View>
                  ))}
                </View>
              ) : step === 2 ? (
                <View style={{ gap: 18 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Feather name="calendar" size={24} color={colors.teal} />
                    <Text style={styles.heading}>Today’s coverage</Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <Avatar member={team[1]} large />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.heading}>{team[1].name}</Text>
                      <Text style={styles.small}>
                        On call · Internal medicine
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.small}>
                    Calendar view ↔ Daily assignments
                  </Text>
                </View>
              ) : step === 3 ? (
                <View style={{ gap: 14 }}>
                  <View
                    style={{
                      alignSelf: "flex-end",
                      backgroundColor: colors.teal,
                      borderRadius: 16,
                      padding: 14,
                      maxWidth: "88%",
                    }}
                  >
                    <Text style={{ color: colors.onAccent, fontSize: 15 }}>
                      Can we review the shift handoff?
                    </Text>
                  </View>
                  <Text style={[styles.small, { textAlign: "right" }]}>
                    Read
                  </Text>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: colors.white,
                      borderRadius: 16,
                      padding: 14,
                      maxWidth: "88%",
                    }}
                  >
                    <Text style={styles.text}>
                      Absolutely. I’m ready when you are.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: "center", gap: 18 }}>
                  <View
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 28,
                      backgroundColor: colors.accentSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name={current.icon}
                      size={40}
                      color={colors.teal}
                    />
                  </View>
                  <Text style={styles.heading}>
                    {step === 4 ? "Nova" : "Directory · Schedule · Inbox"}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
              <Text style={styles.eyebrow}>{current.subtitle}</Text>
              <Text
                accessibilityRole="header"
                style={[styles.title, { fontSize: 27, lineHeight: 34 }]}
              >
                {current.title}
              </Text>
              <Text style={styles.subtitle}>{current.body}</Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <Feather name="info" size={18} color={colors.teal} />
              <Text style={[styles.small, { flex: 1 }]}>{current.hint}</Text>
            </View>
          </View>
          <View style={{ alignItems: "center", gap: 10 }}>
            <View accessible={false} style={{ flexDirection: "row", gap: 6 }}>
              {ONBOARDING_STEPS.map((_, index) => (
                <View
                  key={index}
                  style={{
                    width: index === step ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: index === step ? colors.teal : colors.line,
                  }}
                />
              ))}
            </View>
            <Text style={styles.small}>
              Step {step + 1} of {ONBOARDING_STEPS.length}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {step > 0 && (
              <View style={{ flex: 1 }}>
                <Button
                  title="Back"
                  secondary
                  disabled={busy}
                  onPress={() => setStep((value) => value - 1)}
                />
              </View>
            )}
            <View style={{ flex: 2 }}>
              <Button
                title={
                  busy ? "Saving…" : last ? "Start using Shiftline" : "Next"
                }
                disabled={busy}
                onPress={() =>
                  last ? void finish() : setStep((value) => value + 1)
                }
              />
            </View>
          </View>
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={[styles.text, { color: colors.danger }]}
            >
              {error}
            </Text>
          )}
        </View>
      </Page>
    </SafeAreaView>
  );
}
