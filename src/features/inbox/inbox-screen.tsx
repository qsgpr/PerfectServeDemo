import { useState } from "react";
import {
  Modal,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../auth/auth-provider";
import { useCare } from "../../state/care-provider";
import { TeamSpaces } from "./team-spaces";
import { memberSpace, SpaceId, TEAM_SPACES } from "../../domain/chat";
import { useSavedDraft } from "../../hooks/use-saved-draft";
import { Priority } from "../../domain/types";
import {
  Button,
  DataGate,
  Empty,
  MessageCard,
  LoadingSkeleton,
  useUI,
} from "../../components/ui";
import { ListPage } from "../../components/list-page";
import { Choice } from "../../components/choice";
export function Inbox() {
  const { colors, styles } = useUI();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [archive, setArchive] = useState(false);
  const [query, setQuery] = useState("");
  const { data } = useCare();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ space?: string }>();
  const savedFilters = useSavedDraft(
    "shiftline.inbox-filters.v1",
    { space: "all" as SpaceId, priority: "All" as "All" | Priority },
    (value): value is { space: SpaceId; priority: "All" | Priority } =>
      !!value &&
      typeof value === "object" &&
      "space" in value &&
      TEAM_SPACES.some((s) => s.id === value.space) &&
      "priority" in value &&
      (value.priority === "All" ||
        value.priority === "Routine" ||
        value.priority === "Urgent"),
  );
  const space: SpaceId = TEAM_SPACES.some((s) => s.id === params.space)
    ? (params.space as SpaceId)
    : savedFilters.value.space;
  const setSpace = (space: SpaceId) => {
    router.setParams({ space });
    savedFilters.update({ space });
  };
  const recipient =
    space === "all"
      ? undefined
      : data?.team.find(
          (member) =>
            memberSpace(member) === space &&
            (!member.userId || member.userId !== session?.id),
        );
  const filter = savedFilters.value.priority;
  const setFilter = (priority: "All" | Priority) =>
    savedFilters.update({ priority, space });
  const activeFilters = archive || filter !== "All" || space !== "all";
  const messages =
    data?.messages.filter(
      (m) =>
        Boolean(m.resolvedAt) === archive &&
        (!query.trim() ||
          [
            m.subject,
            m.body,
            data.team.find((member) => member.id === m.recipientId)?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase())) &&
        (filter === "All" || m.priority === filter) &&
        (space === "all" ||
          memberSpace(
            data.team.find((member) => member.id === m.recipientId),
          ) === space),
    ) ?? [];
  if (!savedFilters.ready) return <LoadingSkeleton />;
  return (
    <DataGate>
      <ListPage
        compact
        title="Inbox"
        action={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter conversations"
              accessibilityState={{ expanded: filtersOpen }}
              onPress={() => setFiltersOpen(true)}
              style={{
                minHeight: 44,
                paddingHorizontal: 12,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                backgroundColor: activeFilters
                  ? colors.accentSoft
                  : colors.soft,
              }}
            >
              <Feather name="sliders" size={17} color={colors.teal} />
              <Text style={{ color: colors.teal, fontWeight: "600" }}>
                Filter
                {activeFilters
                  ? " · " +
                    (Number(archive) +
                      Number(filter !== "All") +
                      Number(space !== "all"))
                  : ""}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New message"
              onPress={() =>
                router.push({
                  pathname: "/compose",
                  params: { recipientId: recipient?.id },
                })
              }
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: colors.teal,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="plus" size={21} color={colors.onAccent} />
            </Pressable>
          </View>
        }
        data={messages}
        header={
          <>
            {!!savedFilters.error && (
              <Text accessibilityRole="alert" style={styles.text}>
                {savedFilters.error}
              </Text>
            )}
            <TextInput
              accessibilityLabel="Search conversations"
              placeholder="Search conversations"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
              autoCorrect={false}
            />
          </>
        }
        renderItem={({ item: m }) => (
          <MessageCard
            key={m.id}
            message={m}
            member={data?.team.find((p) => p.id === m.recipientId)}
            onPress={() =>
              router.push({
                pathname: "/conversation",
                params: { messageId: m.id },
              })
            }
          />
        )}
        empty={
          <Empty
            title={archive ? "No resolved conversations" : "Nothing here yet"}
            detail={
              archive
                ? "Resolved conversations are preserved here."
                : "Create a message or choose another priority filter."
            }
          />
        }
      />
      <Modal
        visible={filtersOpen}
        transparent
        animationType="none"
        onRequestClose={() => setFiltersOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 20,
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss filters"
            onPress={() => setFiltersOpen(false)}
            style={{ position: "absolute", inset: 0 }}
          />
          <View
            accessibilityViewIsModal
            aria-modal
            accessibilityRole="none"
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "85%",
              alignSelf: "center",
              borderRadius: 22,
              backgroundColor: colors.paper,
              padding: 20,
              gap: 20,
            }}
          >
            <Text accessibilityRole="header" style={styles.heading}>
              Filter conversations
            </Text>
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <Text style={styles.label}>Department</Text>
              <TeamSpaces
                selected={space}
                onSelect={setSpace}
                team={data?.team ?? []}
              />
              <Text style={styles.label}>Conversation state</Text>
              <View style={styles.row}>
                <Choice
                  label="Active"
                  selected={!archive}
                  onPress={() => setArchive(false)}
                />
                <Choice
                  label="Resolved"
                  selected={archive}
                  onPress={() => setArchive(true)}
                />
              </View>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.row}>
                {(["All", "Routine", "Urgent"] as const).map((f) => (
                  <Choice
                    key={f}
                    label={f}
                    selected={filter === f}
                    onPress={() => setFilter(f)}
                  />
                ))}
              </View>
            </ScrollView>
            <Button
              title="Show conversations"
              onPress={() => setFiltersOpen(false)}
            />
            <Button
              title="Reset filters"
              secondary
              onPress={() => {
                setFilter("All");
                setSpace("all");
              }}
            />
          </View>
        </View>
      </Modal>
    </DataGate>
  );
}
