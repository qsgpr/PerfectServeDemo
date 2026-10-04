import React, { useEffect, useState } from "react";
import { AccessibilityInfo, View, ViewProps } from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useTheme } from "../theme/theme-provider";
export function GlassSurface({ children, style, ...props }: ViewProps) {
  const { colors, dark } = useTheme();
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduceTransparency(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const available =
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable() &&
    !reduceTransparency;
  return available ? (
    <GlassView
      {...props}
      glassEffectStyle="regular"
      colorScheme={dark ? "dark" : "light"}
      style={[{ borderRadius: 20, overflow: "hidden" }, style]}
    >
      {children}
    </GlassView>
  ) : (
    <View
      {...props}
      style={[
        {
          borderRadius: 20,
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
