import { DEPARTMENTS } from "../../domain/workflows";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Avatar, Badge, Button, time, useUI } from "../../components/ui";
import { dayLabel, utcDay } from "../../domain/schedule";
import type { Shift, TeamMember } from "../../domain/types";

export function DayHeading({
  day,
  now,
  count,
}: {
  day: string;
  now: string;
  count: number;
}) {
  const { styles } = useUI();
  return (
    <View style={styles.spread}>
      <Text accessibilityRole="header" style={styles.heading}>
        {day === utcDay(now) ? "Today" : dayLabel(day)}
      </Text>
      <Text style={styles.small}>
        {day === utcDay(now) ? dayLabel(day) : `${count} assignments`}
      </Text>
    </View>
  );
}

export function AssignmentRow({
  day,
  shift,
  member,
  now,
  canMessage,
}: {
  day: string;
  shift: Shift;
  member?: TeamMember;
  now: string;
  canMessage: boolean;
}) {
  const { colors, styles } = useUI();
  const onCall =
    Date.parse(shift.start) <= Date.parse(now) &&
    Date.parse(now) < Date.parse(shift.end);
  const continues = utcDay(shift.start) < day;
  const nextDay = utcDay(shift.end) > day;
  return (
    <View
      testID={`assignment-${shift.id}`}
      style={[
        styles.card,
        { gap: 10, borderColor: onCall ? colors.teal : colors.line },
      ]}
    >
      <Text style={styles.eyebrow}>
        {shift.department
          ? DEPARTMENTS.find((d) => d.id === shift.department)?.name
          : "Primary coverage"}
      </Text>
      <View style={styles.spread}>
        <View style={[styles.row, { flex: 1, minWidth: 0 }]}>
          {member && <Avatar member={member} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heading}>{member?.name ?? "Unassigned"}</Text>
            <Text style={styles.small}>
              {member?.role ?? "Care team"} · {member?.specialty}
            </Text>
          </View>
        </View>
        <Badge
          label={
            onCall
              ? "On call now"
              : Date.parse(shift.end) <= Date.parse(now)
                ? "Completed"
                : "Scheduled"
          }
        />
      </View>
      <Text style={styles.text}>
        {time(shift.start)}–{time(shift.end)} UTC
        {nextDay ? " · ends next day" : ""}
      </Text>
      {member && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Button
              title={`View ${member.name} profile`}
              secondary
              icon="user"
              onPress={() =>
                router.push({
                  pathname: "/contact",
                  params: { memberId: member.id },
                })
              }
            />
          </View>
          {canMessage ? (
            <View style={{ flex: 1, minWidth: 120 }}>
              <Button
                title={`Message ${member.name.split(" ")[0]}`}
                secondary
                icon="message-circle"
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { recipientId: member.id },
                  })
                }
              />
            </View>
          ) : (
            <Text style={[styles.small, { alignSelf: "center" }]}>
              Your assignment
            </Text>
          )}
        </View>
      )}
      {continues && (
        <Text style={styles.small}>Continues from the previous day</Text>
      )}
    </View>
  );
}
