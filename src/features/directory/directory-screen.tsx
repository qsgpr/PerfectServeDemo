import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ListPage } from "../../components/list-page";
import { router } from "expo-router";
import { useAuth } from "../auth/auth-provider";
import { useCare } from "../../state/care-provider";
import { coverage, searchTeam } from "../../data/care-service";
import { useSavedDraft } from "../../hooks/use-saved-draft";
import {
  Avatar,
  Badge,
  Button,
  DataGate,
  Empty,
  LoadingSkeleton,
  useUI,
  PresenceLabel,
} from "../../components/ui";

export function Directory() {
  const { colors, styles } = useUI();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const { data, realNow } = useCare();
  const savedSearch = useSavedDraft(
    "shiftline.directory-search.v1",
    { query: "" },
    (value): value is { query: string } =>
      !!value &&
      typeof value === "object" &&
      "query" in value &&
      typeof value.query === "string",
  );
  const query = savedSearch.value.query;
  const setQuery = (query: string) => savedSearch.update({ query });
  const members = searchTeam(
    (data?.team ?? []).filter((m) => m.userId !== session?.id || !m.userId),
    query,
  );
  const onCall = coverage(data?.shifts ?? [], realNow).current?.memberId;
  if (!savedSearch.ready) return <LoadingSkeleton />;
  return (
    <DataGate>
      <ListPage
        compact
        title="Directory"
        subtitle="Find teammates by name, role, or specialty."
        data={members}
        numColumns={width >= 720 ? 2 : 1}
        header={
          <>
            {!!savedSearch.error && (
              <Text accessibilityRole="alert" style={styles.text}>
                {savedSearch.error}
              </Text>
            )}
            <TextInput
              accessibilityLabel="Search team by name, role, or specialty"
              placeholder="Search name, role, or specialty"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
              autoCorrect={false}
            />
            <View style={styles.spread}>
              <Text accessibilityLiveRegion="polite" style={styles.small}>
                {members.length} team{" "}
                {members.length === 1 ? "member" : "members"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Message a department"
                onPress={() => router.push("/departments")}
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Feather name="users" size={17} color={colors.teal} />
                <Text style={{ color: colors.teal, fontWeight: "600" }}>
                  Departments
                </Text>
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item: m }) =>
          width < 720 ? (
            <View
              style={[
                styles.card,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                },
              ]}
            >
              <Avatar member={m} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${m.name} profile`}
                onPress={() =>
                  router.push({
                    pathname: "/contact",
                    params: { memberId: m.id },
                  })
                }
                style={{ flex: 1, minWidth: 0, minHeight: 44, gap: 3 }}
              >
                <Text
                  style={[styles.text, { fontWeight: "600" }]}
                  numberOfLines={1}
                >
                  {m.name}
                </Text>
                <Text style={styles.small} numberOfLines={1}>
                  {m.role} · {m.specialty}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <PresenceLabel presence={m.presence} />
                  {onCall === m.id && <Badge label="On call" />}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Message ${m.name.split(" ")[0]}`}
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { recipientId: m.id },
                  })
                }
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.soft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="message-circle" size={20} color={colors.teal} />
              </Pressable>
            </View>
          ) : (
            <View key={m.id} style={[styles.card, { flex: 1 }]}>
              <View style={styles.spread}>
                <Avatar member={m} />
                {onCall === m.id && <Badge label="On call" />}
              </View>
              <View>
                <Text style={styles.heading}>{m.name}</Text>
                <Text style={styles.subtitle}>{m.role}</Text>
                <Text style={styles.small}>{m.specialty}</Text>
                {!!m.userId && <Badge label="Registered teammate" />}
                <PresenceLabel presence={m.presence} />
              </View>
              <Button
                title={`View ${m.name} profile`}
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/contact",
                    params: { memberId: m.id },
                  })
                }
              />
              <Button
                title={`Message ${m.name.split(" ")[0]}`}
                secondary
                icon="message-circle"
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { recipientId: m.id },
                  })
                }
              />
            </View>
          )
        }
        empty={
          <Empty
            title="No team members found"
            detail="Try another name, role, or specialty."
          />
        }
      />
    </DataGate>
  );
}
