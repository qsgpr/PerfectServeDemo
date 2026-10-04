import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "../theme/theme-provider";
/** Native implementation is selected by Metro on iOS; other platforms retain readable surfaces. */
export function GlassSurface({ children, style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          borderRadius: 20,
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.line,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
