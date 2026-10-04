import { View } from "react-native";
import { Choice } from "../../components/choice";
import { DEPARTMENTS } from "../../domain/workflows";
import { useState } from "react";
import { useAuth } from "../auth/auth-provider";
import { ListPage } from "../../components/list-page";
import { DataGate, Empty } from "../../components/ui";
import { useCare } from "../../state/care-provider";
import {
  monthOf,
  moveMonth,
  shiftsForDay,
  utcDay,
} from "../../domain/schedule";
import { MonthCalendar } from "./month-calendar";
import { AssignmentRow, DayHeading } from "./day-assignments";

export function Schedule() {
  const { data, realNow } = useCare();
  const { session } = useAuth();
  const today = utcDay(realNow);
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
  const assignments = shiftsForDay(shifts, day);
  return (
    <DataGate>
      <ListPage
        title="Schedule"
        subtitle="On-call coverage · Live time · All times UTC"
        testID="day-assignments"
        data={assignments}
        renderItem={({ item }) => {
          const member = data?.team.find((p) => p.id === item.memberId);
          return (
            <AssignmentRow
              day={day}
              shift={item}
              member={member}
              now={realNow}
              canMessage={!member?.userId || member.userId !== session?.id}
            />
          );
        }}
        empty={
          <Empty
            title="No assignments for this day"
            detail="Select another date to see scheduled coverage."
          />
        }
        header={
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { id: "all", name: "All coverage" },
                { id: "primary", name: "Primary coverage" },
                ...DEPARTMENTS,
              ].map((d) => (
                <Choice
                  key={d.id}
                  label={d.name}
                  selected={filter === d.id}
                  onPress={() => setFilter(d.id)}
                />
              ))}
            </View>
            <MonthCalendar
              month={month}
              selectedDay={day}
              today={today}
              shifts={shifts}
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
