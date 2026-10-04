import React from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useUI } from "./ui";
import { IconButton } from "./icon-button";
export function Sheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const { colors, styles, reducedMotion } = useUI();
  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#00000066",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.paper,
            borderRadius: 26,
            padding: 20,
            maxHeight: "90%",
            width: "100%",
            maxWidth: 600,
            alignSelf: "center",
            gap: 18,
          }}
        >
          <View style={styles.spread}>
            <Text accessibilityRole="header" style={styles.heading}>
              {title}
            </Text>
            <IconButton label="Close panel" name="x" onPress={close} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 18 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
