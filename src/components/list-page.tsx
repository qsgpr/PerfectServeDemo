import type { ReactNode } from "react";
import {
  FlatList,
  Platform,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUI } from "./ui";

// One scroll owner: never nest this virtualized list in Page's ScrollView.
export function ListPage<T extends { id: string }>({
  title,
  subtitle,
  action,
  compact = false,
  data,
  renderItem,
  header,
  empty,
  numColumns = 1,
  testID = "page-scroll",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
  data: T[];
  renderItem: ListRenderItem<T>;
  header?: ReactNode;
  empty?: ReactNode;
  numColumns?: number;
  testID?: string;
}) {
  const { styles } = useUI();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const nativeTab =
    Platform.OS === "ios" && (segments as string[]).includes("(tabs)");
  return (
    <FlatList
      key={numColumns}
      testID={testID}
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        // Separators handle row spacing; gap would also space FlatList's spacer cells.
        { gap: 0, paddingBottom: (nativeTab ? 88 : 40) + insets.bottom },
      ]}
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={numColumns}
      columnWrapperStyle={numColumns > 1 ? { gap: 16 } : undefined}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
      ListHeaderComponent={
        <View style={{ gap: 20, paddingBottom: 20 }}>
          <View style={[styles.spread, compact && { flexWrap: "nowrap" }]}>
            <View style={{ gap: 7, flexShrink: 1 }}>
              <Text
                accessibilityRole="header"
                numberOfLines={compact ? 1 : undefined}
                style={[
                  styles.title,
                  compact && { fontSize: 24, lineHeight: 32 },
                ]}
              >
                {title}
              </Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {action}
          </View>
          {header}
        </View>
      }
      ListEmptyComponent={empty ? <View>{empty}</View> : null}
    />
  );
}
