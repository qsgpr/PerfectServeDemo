import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Choice } from "../../components/choice";
import { DEPARTMENTS } from "../../domain/workflows";
import { useState } from "react";
import { useAuth } from "../auth/auth-provider";
import { ListPage } from "../../components/list-page";
import { DataGate, Empty, useUI } from "../../components/ui";
import { useCare } from "../../state/care-provider";
import {
  monthOf,
  moveMonth,
  localShiftsForDay,
  localDay,
  hideCompletedShifts,
  groupShiftsByMember,
} from "../../domain/schedule";
import { MonthCalendar } from "./month-calendar";
import { AssignmentRow, DayHeading } from "./day-assignments";

export function Schedule() {
  const { colors, styles } = useUI();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data, realNow } = useCare();
  const { session } = useAuth();
  const today = localDay(realNow);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [groupByMember, setGroupByMember] = useState(true);
  // A null selection follows the current day; explicit browsing stays on the selected date.
  const [selection, setSelection] = useState<{
    day: string;
    month: string;
  } | null>(null);
  const day = selection?.day ?? today;
  const month = selection?.month ?? monthOf(today);
  const [filter, setFilter] = useState("all");
  const shifts = (data?.shifts ?? []).filter(
    (s) =>
      filter === "all" ||
      (filter === "primary" ? !s.department : s.department === filter),
  );
  const visibleShifts = hideCompleted
    ? hideCompletedShifts(shifts, realNow)
    : shifts;
  const assignments = groupShiftsByMember(
    localShiftsForDay(visibleShifts, day),
    groupByMember,
  );
  return (
    <DataGate>
      <ListPage
        compact
        title="Schedule"
        subtitle="On-call coverage · Local time (AM/PM)"
        testID="day-assignments"
        data={assignments}
        renderItem={({ item }) => {
          const member = data?.team.find((p) => p.id === item.memberId);
          return (
            <AssignmentRow
              day={day}
              shift={item}
              departments={item.departments}
              member={member}
              now={realNow}
              canMessage={!member?.userId || member.userId !== session?.id}
            />
          );
        }}
        empty={
          <Empty
            title={
              hideCompleted
                ? "No remaining shifts for this day"
                : "No assignments for this day"
            }
            detail={
              hideCompleted
                ? "Show completed shifts or select another date."
                : "Select another date to see scheduled coverage."
            }
          />
        }
        header={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter coverage"
              accessibilityState={{ expanded: filtersOpen }}
              aria-expanded={filtersOpen}
              onPress={() => setFiltersOpen((value) => !value)}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Feather name="sliders" size={18} color={colors.teal} />
              <Text
                style={[
                  styles.text,
                  { color: colors.teal, fontWeight: "600", flex: 1 },
                ]}
              >
                Coverage:{" "}
                {filter === "all"
                  ? "All"
                  : filter === "primary"
                    ? "Primary"
                    : DEPARTMENTS.find((d) => d.id === filter)?.name}
                {hideCompleted ? " · Remaining shifts" : ""}
                {groupByMember ? " · Grouped" : ""}
              </Text>
              <Feather
                name={filtersOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.teal}
              />
            </Pressable>
            {filtersOpen && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Hide completed shifts"
                  accessibilityState={{ checked: hideCompleted }}
                  aria-checked={hideCompleted}
                  onPress={() => setHideCompleted((value) => !value)}
                  style={{
                    minHeight: 46,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 10,
                    backgroundColor: colors.soft,
                  }}
                >
                  <Feather
                    name={hideCompleted ? "check-square" : "square"}
                    size={18}
                    color={colors.teal}
                  />
                  <Text style={styles.text}>Hide completed shifts</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Group by teammate"
                  accessibilityState={{ checked: groupByMember }}
                  aria-checked={groupByMember}
                  onPress={() => setGroupByMember((value) => !value)}
                  style={{
                    minHeight: 46,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 10,
                    backgroundColor: colors.soft,
                  }}
                >
                  <Feather
                    name={groupByMember ? "check-square" : "square"}
                    size={18}
                    color={colors.teal}
                  />
                  <Text style={styles.text}>Group by teammate</Text>
                </Pressable>
                <Text style={[styles.small, { width: "100%" }]}>
                  Combine coverage for the same teammate when shift times match.
                </Text>
                {[
                  { id: "all", name: "All coverage" },
                  { id: "primary", name: "Primary coverage" },
                  ...DEPARTMENTS,
                ].map((d) => (
                  <Choice
                    key={d.id}
                    label={d.name}
                    selected={filter === d.id}
                    onPress={() => {
                      setFilter(d.id);
                      setFiltersOpen(false);
                    }}
                  />
                ))}
              </View>
            )}
            <MonthCalendar
              month={month}
              selectedDay={day}
              today={today}
              shifts={visibleShifts}
              groupByMember={groupByMember}
              onSelect={(day) => setSelection({ day, month: monthOf(day) })}
              onMoveMonth={(offset) => {
                const next = moveMonth(month, offset);
                setSelection({ month: next, day: next + "-01" });
              }}
              onToday={() => setSelection(null)}
            />
            <DayHeading day={day} count={assignments.length} now={realNow} />
          </>
        }
      />
    </DataGate>
  );
}
