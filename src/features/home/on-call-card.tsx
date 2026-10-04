import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../auth/auth-provider";
import { Feather } from "@expo/vector-icons";
import {
  Avatar,
  Button,
  time,
  useUI,
  PresenceLabel,
} from "../../components/ui";
import type { TeamMember, Shift } from "../../domain/types";
export function OnCallCard({
  provider,
  nextProvider,
  current,
  next,
}: {
  provider?: TeamMember;
  nextProvider?: TeamMember;
  current?: Shift;
  next?: Shift;
}) {
  const { colors, styles } = useUI();
  const { session } = useAuth();
  const yourShift = !!provider?.userId && provider.userId === session?.id;
  return (
    <View
      testID="on-call-card"
      style={[
        styles.card,
        {
          backgroundColor: colors.hero,
          borderColor: colors.hero,
          padding: 22,
          gap: 20,
        },
      ]}
    >
      <Text style={[styles.eyebrow, { color: "#B3D7BD" }]}>
        PRIMARY ON CALL NOW
      </Text>
      {provider ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Avatar member={provider} large />
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Text
                style={{
                  color: "white",
                  fontSize: 25,
                  lineHeight: 32,
                  fontWeight: "600",
                }}
              >
                {provider.name}
              </Text>
              <Text style={{ color: "#CBD9D9", fontSize: 14, lineHeight: 21 }}>
                {provider.specialty}
              </Text>
              <PresenceLabel presence={provider.presence} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="clock" size={16} color="#CBD9D9" />
            <Text
              style={{
                color: "#CBD9D9",
                fontSize: 14,
                lineHeight: 21,
                flex: 1,
              }}
            >
              {time(current!.start)}–{time(current!.end)} UTC
            </Text>
          </View>
          {yourShift ? (
            <Text style={{ color: "white" }}>You are on call</Text>
          ) : (
            <Button
              title="Message on-call provider"
              icon="message-circle"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/compose",
                  params: { recipientId: provider.id },
                })
              }
            />
          )}
        </>
      ) : (
        <Text style={{ color: "white" }}>No coverage at this time.</Text>
      )}
      <View
        testID="next-shift-row"
        style={{
          paddingTop: 18,
          borderTopWidth: 1,
          borderColor: "#3F565D",
          gap: 7,
        }}
      >
        <Text
          style={{
            color: "#B3D7BD",
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 1,
          }}
        >
          NEXT SHIFT
        </Text>
        <Text style={{ color: "white", fontSize: 15, lineHeight: 23 }}>
          {nextProvider
            ? nextProvider.name + " · " + time(next!.start) + " UTC"
            : "No upcoming shifts"}
        </Text>
      </View>
    </View>
  );
}
