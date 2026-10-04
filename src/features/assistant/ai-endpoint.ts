import Constants from "expo-constants";
import { Platform } from "react-native";
export function aiEndpoint() {
  const configured = process.env.EXPO_PUBLIC_AI_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (Platform.OS === "web")
    return window.location.protocol + "//" + window.location.hostname + ":8082";
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (!host || host.endsWith(".exp.direct"))
    throw new Error(
      "For tunnel connections, set EXPO_PUBLIC_AI_BASE_URL to an AI server reachable by your phone.",
    );
  return "http://" + host + ":8082";
}
