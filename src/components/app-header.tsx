import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../theme/theme-provider";
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
          height: 64,
          width: "100%",
          maxWidth: 1040,
          alignSelf: "center",
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Brand />
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
          <Feather name="user" size={21} color={colors.teal} />
        </Pressable>
      </View>
    </View>
  );
}
