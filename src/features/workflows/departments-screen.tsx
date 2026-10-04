import { Text, View } from "react-native";
import { router } from "expo-router";
import { useCare } from "../../state/care-provider";
import { useAuth } from "../auth/auth-provider";
import { useWorkflows } from "../../state/workflow-provider";
import {
  DEPARTMENTS,
  departmentCoverage,
  resolveDepartmentRoute,
} from "../../domain/workflows";
import {
  Avatar,
  Button,
  DataGate,
  Page,
  time,
  useUI,
} from "../../components/ui";
export default function Departments() {
  const { styles } = useUI();
  const { data, realNow } = useCare();
  const { reachability, error } = useWorkflows();
  const { session } = useAuth();
  return (
    <DataGate>
      <Page
        title="Message a department"
        subtitle="Routing follows current coverage and reachability."
      >
        {!!error && (
          <Text accessibilityRole="alert" style={styles.text}>
            {error}
          </Text>
        )}
        {DEPARTMENTS.map((d) => {
          const coverage = departmentCoverage(data!.shifts, d.id, realNow);
          const person = data!.team.find(
            (m) => m.id === coverage.current?.memberId,
          );
          const route = resolveDepartmentRoute(
            data!.team,
            data!.shifts,
            reachability,
            d.id,
            "Routine",
            realNow,
            session!.id,
          );
          return (
            <View key={d.id} style={styles.card}>
              <Text style={styles.heading}>{d.name}</Text>
              {person ? (
                <View style={styles.row}>
                  <Avatar member={person} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.text}>{person.name}</Text>
                    <Text style={styles.small}>
                      On call until {time(coverage.current!.end)} UTC
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.text}>No current coverage</Text>
              )}
              <Text style={styles.small}>
                {route.recipient
                  ? `Routine messages → ${route.recipient.name} · ${route.reason}`
                  : route.reason}
              </Text>
              <Button
                title={`Message ${d.name}`}
                secondary
                disabled={!person || !!error}
                onPress={() =>
                  router.push({
                    pathname: "/compose",
                    params: { department: d.id },
                  })
                }
              />
            </View>
          );
        })}
      </Page>
    </DataGate>
  );
}
