import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "../theme/theme-provider";
export default function IosTabs() {
  const { colors } = useTheme();
  return (
    <NativeTabs
      minimizeBehavior="never"
      tintColor={colors.teal}
      backgroundColor={colors.white}
      labelStyle={{ color: colors.muted }}
    >
      <NativeTabs.Trigger
        disableAutomaticContentInsets
        name="index"
        contentStyle={{ backgroundColor: colors.paper }}
      >
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        disableAutomaticContentInsets
        name="directory"
        contentStyle={{ backgroundColor: colors.paper }}
      >
        <NativeTabs.Trigger.Label>Directory</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        disableAutomaticContentInsets
        name="schedule"
        contentStyle={{ backgroundColor: colors.paper }}
      >
        <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        disableAutomaticContentInsets
        name="inbox"
        contentStyle={{ backgroundColor: colors.paper }}
      >
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "bubble.left.and.bubble.right",
            selected: "bubble.left.and.bubble.right.fill",
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
