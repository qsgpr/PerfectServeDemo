import { useEffect, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useUI } from "../../components/ui";

export function TypingBubble({ label }: { label: string }) {
  const { colors, styles, reducedMotion } = useUI();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reducedMotion]);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 22,
        borderBottomLeftRadius: 6,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        gap: 5,
      }}
    >
      <Text style={styles.small}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          height: 10,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: colors.teal,
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35 + index * 0.16, 1],
              }),
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3 - index, index - 2],
                  }),
                },
              ],
            }}
          />
        ))}
      </View>
    </View>
  );
}
