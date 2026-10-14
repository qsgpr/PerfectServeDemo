import React from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../theme/theme-provider";
import { Avatar } from "./ui";
import { useAuth } from "../features/auth/auth-provider";
import { useCare } from "../state/care-provider";
export function Brand() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Shiftline"
      delayLongPress={800}
      onLongPress={() => router.push("/tools")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        minHeight: 48,
        flexShrink: 1,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 10,
          backgroundColor: colors.teal,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Feather name="layers" size={18} color={colors.onAccent} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: colors.ink,
          flexShrink: 1,
        }}
      >
        shiftline.
      </Text>
    </Pressable>
  );
}
export function AppHeader() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1024;
  const { session } = useAuth();
  const { data } = useCare();
  const member = data?.team.find((person) => person.userId === session?.id) ?? {
    id: session?.id ?? "viewer",
    userId: session?.id,
    name: session?.name ?? "Teammate",
    role: "Team member",
    specialty: "",
    initials: session?.name.slice(0, 2).toUpperCase() ?? "TM",
    color: "#DCEDE7",
  };
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="app-header"
      style={{
        backgroundColor: colors.paper,
        paddingTop: insets.top,
        borderBottomWidth: 1,
        borderColor: colors.line,
      }}
    >
      <View
        style={{
          height: width < 600 ? 56 : 64,
          width: "100%",
          maxWidth: desktop ? undefined : 1040,
          alignSelf: "center",
          paddingHorizontal: desktop ? 0 : width < 600 ? 16 : 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: desktop ? 0 : 16,
        }}
      >
        <View
          style={desktop ? { width: 224, paddingHorizontal: 24 } : undefined}
        >
          <Brand />
        </View>
        <View style={desktop ? { flex: 1 } : undefined}>
          <View
            style={
              desktop
                ? {
                    width: "100%",
                    maxWidth: 1040,
                    alignSelf: "center",
                    paddingHorizontal: 20,
                    alignItems: "flex-end",
                  }
                : undefined
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => router.push("/settings")}
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: 16,
                backgroundColor: colors.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Avatar member={member} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
