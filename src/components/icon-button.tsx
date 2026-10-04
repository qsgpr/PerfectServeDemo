import React from "react";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUI } from "./ui";

export function IconButton({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useUI();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 16,
        backgroundColor: colors.soft,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        justifyContent: "center",
        alignItems: "center",
      })}
    >
      <Feather name={name} size={20} color={colors.teal} />
    </Pressable>
  );
}
