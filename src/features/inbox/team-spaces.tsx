import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TEAM_SPACES, SpaceId, memberSpace } from "../../domain/chat";
import { TeamMember } from "../../domain/types";
import { useUI } from "../../components/ui";
export function TeamSpaces({
  selected,
  onSelect,
  team,
  expanded = false,
}: {
  selected: SpaceId;
  onSelect: (id: SpaceId) => void;
  team: TeamMember[];
  expanded?: boolean;
}) {
  const { colors, styles } = useUI();
  return (
    <View style={{ gap: 12 }}>
      {expanded && (
        <View>
          <Text style={styles.heading}>Team spaces</Text>
          <Text style={styles.subtitle}>
            A shared conversation, tailored to each team.
          </Text>
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
      >
        {TEAM_SPACES.map((space) => (
          <Pressable
            key={space.id}
            accessibilityRole="radio"
            accessibilityLabel={space.name + " space"}
            accessibilityState={{ checked: selected === space.id }}
            aria-checked={selected === space.id}
            onPress={() => onSelect(space.id)}
            style={({ pressed }) => ({
              borderRadius: expanded ? 20 : 14,
              padding: expanded ? 18 : 12,
              borderWidth: 1,
              borderColor: selected === space.id ? colors.teal : colors.line,
              backgroundColor:
                selected === space.id ? colors.accentSoft : colors.white,
              minHeight: 48,
              minWidth: expanded ? 145 : undefined,
              gap: 12,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <View style={styles.row}>
              <Feather name={space.icon} size={18} color={colors.teal} />
              <Text style={[styles.text, { fontWeight: "600" }]}>
                {space.name}
              </Text>
            </View>
            {expanded && (
              <Text style={styles.small}>
                {
                  team.filter(
                    (member) =>
                      space.id === "all" || memberSpace(member) === space.id,
                  ).length
                }{" "}
                team members
              </Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
