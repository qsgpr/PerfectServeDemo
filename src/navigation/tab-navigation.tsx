import React from "react";
import { Platform, useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/theme-provider";
const icons = {
  index: "grid",
  directory: "users",
  schedule: "calendar",
  inbox: "message-square",
} as const;
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 1024;
  const { colors, feedback } = useTheme();
  return (
    <Tabs
      screenListeners={{ tabPress: () => feedback() }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        // Change presentation without replacing the navigator or screen state.
        tabBarPosition: desktop ? "left" : "bottom",
        tabBarVariant: desktop ? "material" : "uikit",
        tabBarLabelPosition: desktop ? "beside-icon" : undefined,
        tabBarActiveBackgroundColor: desktop ? colors.soft : undefined,
        tabBarItemStyle: desktop
          ? {
              minHeight: 48,
              marginVertical: 4,
              marginHorizontal: 12,
              borderRadius: 12,
            }
          : undefined,
        tabBarStyle: desktop
          ? {
              width: 224,
              minWidth: 224,
              paddingHorizontal: 0,
              backgroundColor: colors.white,
              borderRightWidth: 1,
              borderRightColor: colors.line,
              borderTopWidth: 0,
              paddingTop: 24,
              paddingBottom: 16,
            }
          : {
              backgroundColor: colors.white,
              borderTopColor: colors.line,
              height: (width < 600 ? 64 : 76) + insets.bottom,
              paddingTop: 6,
              paddingBottom: Math.max(insets.bottom, 10),
            },
        tabBarLabelStyle: {
          fontSize: desktop ? 14 : 11,
          lineHeight: desktop ? 20 : 16,
          fontWeight: desktop ? "600" : undefined,
          marginTop: desktop ? 0 : 2,
          flexShrink: 0,
        },
        tabBarIcon: ({ color, size }) => (
          <Feather
            name={icons[route.name as keyof typeof icons]}
            color={color}
            size={size - 3}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="directory" options={{ title: "Directory" }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule" }} />
      <Tabs.Screen name="inbox" options={{ title: "Inbox" }} />
    </Tabs>
  );
}
