import {
  Modal,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
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
  const { colors, styles } = useUI();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(12, 31, 38, 0.36)",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss recipient picker"
          onPress={onClose}
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          accessibilityViewIsModal
          aria-modal
          accessibilityLabel={title}
          style={{
            maxHeight: "88%",
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            backgroundColor: colors.paper,
            padding: 20,
            gap: 16,
          }}
        >
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
            autoFocus
            accessibilityLabel="Search recipients"
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search name, role, or specialty"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <FlatList
            style={{ flexShrink: 1 }}
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
            renderItem={({ item: member }) => (
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
                  borderColor:
                    recipientId === member.id ? colors.teal : colors.line,
                  backgroundColor:
                    recipientId === member.id
                      ? colors.accentSoft
                      : colors.white,
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
                {(member.id === currentMemberId ||
                  member.id === nextMemberId) && (
                  <Badge
                    label={
                      member.id === currentMemberId ? "On call" : "Next shift"
                    }
                  />
                )}
                {recipientId === member.id && (
                  <Feather name="check" size={20} color={colors.teal} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <Empty
                title="No recipients found"
                detail="Try a different name, role, or specialty."
              />
            }
          />
        </View>
      </View>
    </Modal>
  );
}
