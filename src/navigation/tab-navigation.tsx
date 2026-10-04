import React from "react";
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
  const { colors, feedback } = useTheme();
  return (
    <Tabs
      screenListeners={{ tabPress: () => feedback() }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 76 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 16,
          marginTop: 2,
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
