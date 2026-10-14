import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/theme-provider";
/** Deep links have no stack history; they still need a way back to the tabs. */
export function BackButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={{
        minWidth: 44,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingRight: 8,
      }}
    >
      <Feather name="arrow-left" size={22} color={colors.teal} />
      <Text style={{ color: colors.teal, fontSize: 15, fontWeight: "600" }}>
        Back
      </Text>
    </Pressable>
  );
}
