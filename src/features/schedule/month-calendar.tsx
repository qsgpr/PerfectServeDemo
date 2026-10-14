import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUI } from "../../components/ui";
import {
  dayLabel,
  monthCells,
  monthLabel,
  localShiftsForDay,
  groupShiftsByMember,
} from "../../domain/schedule";
import type { Shift } from "../../domain/types";

interface CalendarProps {
  month: string;
  selectedDay: string;
  today: string;
  shifts: Shift[];
  groupByMember?: boolean;
  onSelect: (day: string) => void;
  onMoveMonth: (offset: number) => void;
  onToday: () => void;
}
export function MonthCalendar({
  month,
  selectedDay,
  today,
  shifts,
  groupByMember = false,
  onSelect,
  onMoveMonth,
  onToday,
}: CalendarProps) {
  const { colors, styles } = useUI();
  return (
    <View
      style={[styles.card, { padding: 14, gap: 12 }]}
      testID="schedule-calendar"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => onMoveMonth(-1)}
          style={{
            width: 44,
            height: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Feather name="chevron-left" size={22} color={colors.teal} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { flex: 1, textAlign: "center" }]}
        >
          {monthLabel(month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => onMoveMonth(1)}
          style={{
            width: 44,
            height: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Feather name="chevron-right" size={22} color={colors.teal} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
          <Text
            key={index}
            style={[styles.small, { flex: 1, textAlign: "center" }]}
          >
            {label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {monthCells(month).map((day, index) => {
          if (!day)
            return (
              <View
                key={"blank-" + index}
                style={{ width: "14.285714%", minHeight: 52 }}
              />
            );
          const selected = day === selectedDay;
          const currentDay = day === today;
          const assignments = groupShiftsByMember(
            localShiftsForDay(shifts, day),
            groupByMember,
          );
          return (
            <View key={day} style={{ width: "14.285714%", padding: 2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel(day)}, ${assignments.length} shifts${currentDay ? ", Today" : ""}`}
                accessibilityState={{ selected }}
                aria-pressed={selected}
                onPress={() => onSelect(day)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: currentDay ? colors.teal : "transparent",
                  backgroundColor: selected ? colors.teal : colors.white,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: selected || currentDay ? "700" : "400",
                    color: selected ? colors.onAccent : colors.ink,
                  }}
                >
                  {Number(day.slice(-2))}
                </Text>
                <View style={{ height: 4, flexDirection: "row", gap: 3 }}>
                  {assignments.slice(0, 3).map((shift) => (
                    <View
                      key={shift.id}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: selected
                          ? colors.onAccent
                          : colors.teal,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={[styles.small, { flex: 1 }]}>
          Dots indicate shifts · outlined day is today
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to today"
          onPress={onToday}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ color: colors.teal, fontWeight: "600" }}>Today</Text>
        </Pressable>
      </View>
    </View>
  );
}
