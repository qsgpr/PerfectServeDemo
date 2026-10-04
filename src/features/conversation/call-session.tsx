import React, { useEffect, useRef, useState } from "react";
import { AppState, Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar, useUI } from "../../components/ui";
import { formatDuration } from "../../domain/chat";
import { TeamMember } from "../../domain/types";

export function CallSession({
  mode,
  member,
  onFinish,
}: {
  mode: "voice" | "video";
  member: TeamMember;
  onFinish: (duration: number, outcome: "completed" | "cancelled") => void;
}) {
  const { colors, reducedMotion } = useUI();
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [camera, setCamera] = useState(true);
  const started = useRef<number | null>(null);
  const ended = useRef(false);
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);
  const end = () => {
    if (ended.current) return;
    ended.current = true;
    const duration =
      started.current === null
        ? 0
        : Math.floor((Date.now() - started.current) / 1000);
    finish.current(
      duration,
      started.current === null ? "cancelled" : "completed",
    );
  };
  useEffect(() => {
    const connect = setTimeout(() => {
      started.current = Date.now();
      setConnected(true);
    }, 1800);
    const ticker = setInterval(() => {
      if (started.current !== null)
        setSeconds(Math.floor((Date.now() - started.current) / 1000));
    }, 1000);
    const close = () => {
      if (ended.current) return;
      ended.current = true;
      finish.current(
        started.current === null
          ? 0
          : Math.floor((Date.now() - started.current) / 1000),
        started.current === null ? "cancelled" : "completed",
      );
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") close();
    });
    const visibility = () => {
      if (document.hidden) close();
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(connect);
      clearInterval(ticker);
      subscription.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <Modal
      visible
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={end}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.hero }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 720,
            alignSelf: "center",
            padding: 28,
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <View style={{ alignItems: "center", gap: 10 }}>
            <Text
              style={{
                color: "#8EDCC1",
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 2,
              }}
            >
              {mode === "voice" ? "VOICE CALL" : "VIDEO CALL"}
            </Text>
            <Text
              accessibilityRole="header"
              style={{ color: "white", fontSize: 30, fontWeight: "700" }}
            >
              {member.name}
            </Text>
            <Text accessibilityLiveRegion="polite" style={{ color: "#C7D8D2" }}>
              {connected
                ? "Call connected · " + formatDuration(seconds)
                : "Calling…"}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              minHeight: 220,
              justifyContent: "center",
              alignItems: "center",
              gap: 20,
              backgroundColor: mode === "video" ? "#243C3D" : "transparent",
              borderRadius: 28,
            }}
          >
            <Avatar member={member} large />
            <Text style={{ color: "#C7D8D2" }}>{member.role}</Text>
            {mode === "video" && (
              <View
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  backgroundColor: "#101B1B",
                  borderRadius: 18,
                  width: 105,
                  height: 135,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <Feather
                  name={camera ? "user" : "video-off"}
                  color="#8EDCC1"
                  size={32}
                />
                <Text style={{ color: "white" }}>You</Text>
              </View>
            )}
          </View>
          <View style={{ gap: 22 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              {(
                [
                  {
                    label: muted ? "Unmute microphone" : "Mute microphone",
                    name: muted ? "mic-off" : "mic",
                    active: muted,
                    press: () => setMuted(!muted),
                  },
                  {
                    label: speaker ? "Turn speaker off" : "Turn speaker on",
                    name: speaker ? "volume-2" : "volume-1",
                    active: speaker,
                    press: () => setSpeaker(!speaker),
                  },
                  ...(mode === "video"
                    ? [
                        {
                          label: camera ? "Turn camera off" : "Turn camera on",
                          name: camera ? "video" : "video-off",
                          active: !camera,
                          press: () => setCamera(!camera),
                        },
                      ]
                    : []),
                ] as {
                  label: string;
                  name: React.ComponentProps<typeof Feather>["name"];
                  active: boolean;
                  press: () => void;
                }[]
              ).map((control) => (
                <Pressable
                  key={control.label}
                  accessibilityRole="button"
                  accessibilityLabel={control.label}
                  accessibilityState={{ selected: control.active }}
                  onPress={control.press}
                  style={{
                    minWidth: 64,
                    minHeight: 64,
                    borderRadius: 24,
                    backgroundColor: control.active ? "#8EDCC1" : "#344E4D",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Feather
                    name={control.name}
                    size={26}
                    color={control.active ? "#102A22" : "white"}
                  />
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="End call"
              onPress={end}
              style={{
                minHeight: 58,
                borderRadius: 20,
                backgroundColor: "#C14D48",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "row",
                gap: 12,
              }}
            >
              <Feather name="phone-off" color="white" size={23} />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                End call
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
