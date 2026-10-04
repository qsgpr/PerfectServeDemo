import { Pressable, Text } from "react-native";
import { useUI } from "./ui";

export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useUI();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={{
        minHeight: 46,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: selected ? colors.teal : colors.line,
        backgroundColor: selected ? colors.accentSoft : colors.white,
      }}
    >
      <Text style={{ color: colors.ink, fontWeight: selected ? "700" : "400" }}>
        {label}
      </Text>
    </Pressable>
  );
}
