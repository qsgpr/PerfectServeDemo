import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Avatar, Badge, Empty, useUI } from "../../components/ui";
import type { TeamMember } from "../../domain/types";
export function RecipientPicker({
  visible,
  title = "Choose a recipient",
  members,
  recipientId,
  query,
  currentMemberId,
  nextMemberId,
  onClose,
  onSelect,
  onQueryChange,
}: {
  title?: string;
  visible: boolean;
  members: TeamMember[];
  recipientId: string;
  query: string;
  currentMemberId?: string;
  nextMemberId?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onQueryChange: (query: string) => void;
}) {
  const { colors, styles, reducedMotion } = useUI();
  const [present, setPresent] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  // Mount on open immediately; retain the modal until its exit animation finishes.
  if (visible && !present) setPresent(true);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reducedMotion ? 0 : visible ? 240 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setPresent(false);
    });
    return () => animation.stop();
  }, [visible, reducedMotion, progress]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Keep one interpolation node throughout the transition; viewport/keyboard
  // changes must not replace the animation driving the list container.
  const translateY = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [640 + insets.bottom, 0],
      }),
    [progress, insets.bottom],
  );
  const renderMember = (member: TeamMember) => (
    <Pressable
      key={member.id}
      accessibilityRole="radio"
      accessibilityLabel={member.name}
      accessibilityState={{ checked: recipientId === member.id }}
      aria-checked={recipientId === member.id}
      onPress={() => {
        onSelect(member.id);
      }}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: recipientId === member.id ? colors.teal : colors.line,
        backgroundColor:
          recipientId === member.id ? colors.accentSoft : colors.white,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Avatar member={member} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.text} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.small} numberOfLines={1}>
          {member.role} · {member.specialty}
        </Text>
      </View>
      {(member.id === currentMemberId || member.id === nextMemberId) && (
        <Badge
          label={member.id === currentMemberId ? "On call" : "Next shift"}
        />
      )}
      {recipientId === member.id && (
        <Feather name="check" size={20} color={colors.teal} />
      )}
    </Pressable>
  );
  return (
    <Modal
      visible={present}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "flex-end",
        }}
      >
        <Animated.View
          testID="recipient-backdrop"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(12, 31, 38, 0.36)",
            opacity: progress,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss recipient picker"
            onPress={onClose}
            style={{ position: "absolute", inset: 0 }}
          />
        </Animated.View>
        <Animated.View
          testID="recipient-sheet"
          accessibilityViewIsModal
          aria-modal
          accessibilityLabel={title}
          style={{
            transform: [{ translateY }],
            height: "85%",
            maxHeight: 640,
            width: "100%",
            maxWidth: 600,
            alignSelf: "center",
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: colors.paper,
            padding: 16,
            paddingBottom: 16 + insets.bottom,
            gap: 16,
          }}
        >
          {/* Continue the sheet color beneath the keyboard's rounded corners.
              Keep this separate from the content's keyboard avoidance. */}
          <View
            testID="recipient-keyboard-background"
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              height: windowHeight,
              backgroundColor: colors.paper,
            }}
          />
          <View style={styles.spread}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heading}>{title}</Text>
              <Text style={styles.small}>Search your care team</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close recipient picker"
              onPress={onClose}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.soft,
              }}
            >
              <Feather name="x" size={21} color={colors.teal} />
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Search recipients"
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search name, role, or specialty"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {members.length <= 24 ? (
            <ScrollView
              style={{ flex: 1, minHeight: 0 }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
            >
              {members.map(renderMember)}
              {!members.length && (
                <Empty
                  title="No recipients found"
                  detail="Try a different name, role, or specialty."
                />
              )}
            </ScrollView>
          ) : (
            <FlatList
              style={{ flex: 1, minHeight: 0 }}
              data={members}
              keyExtractor={(member) => member.id}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={false}
              extraData={[recipientId, currentMemberId, nextMemberId]}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 12 }}
              renderItem={({ item }) => renderMember(item)}
              ListEmptyComponent={
                <Empty
                  title="No recipients found"
                  detail="Try a different name, role, or specialty."
                />
              }
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
