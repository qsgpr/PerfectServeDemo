import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../data/supabase";
const DEVICE_KEY = "shiftline.push-device";
const enabledKey = (id: string) => "shiftline.notifications." + id;
let openConversation: string | null = null;
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const visible = !(
      AppState.currentState === "active" &&
      notification.request.content.data?.messageId === openConversation
    );
    return {
      shouldShowBanner: visible,
      shouldShowList: visible,
      shouldPlaySound: visible,
      shouldSetBadge: false,
    };
  },
});
export function setOpenConversation(id: string | null) {
  openConversation = id;
}
export async function enableMessageAlerts(userId: string): Promise<string> {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (
    !permission.granted &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    throw new Error(
      "Notifications are disabled. Allow them in your phone settings.",
    );
  await AsyncStorage.setItem(enabledKey(userId), "local");
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (
    Constants.executionEnvironment === "storeClient" ||
    !projectId ||
    !Device.isDevice
  )
    return "Alerts enabled while the app is open. Background push needs an installed app with an Expo/EAS project and push credentials.";
  if (!supabase)
    throw new Error("Sign in to enable shared-message notifications.");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase
    .from("shiftline_push_devices")
    .upsert({ token, user_id: userId, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  await AsyncStorage.setItem(DEVICE_KEY, token);
  await AsyncStorage.setItem(enabledKey(userId), "push");
  return "Background message notifications are enabled on this device.";
}
export async function getMessageAlertStatus(userId: string): Promise<string> {
  const mode = await AsyncStorage.getItem(enabledKey(userId));
  if (mode === "push") return "Background message notifications enabled.";
  if (mode === "local")
    return "Alerts enabled while the app is open; background push setup is pending.";
  return "Enable alerts for new messages.";
}
export async function showMessageAlert(
  userId: string,
  messageId: string,
): Promise<void> {
  if ((await AsyncStorage.getItem(enabledKey(userId))) !== "local") return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Shiftline",
      body: "You have a new message.",
      sound: "default",
      data: { messageId },
    },
    trigger: null,
  });
}
export async function unregisterMessageAlerts(): Promise<void> {
  const token = await AsyncStorage.getItem(DEVICE_KEY);
  if (token && supabase) {
    const { error } = await supabase
      .from("shiftline_push_devices")
      .delete()
      .eq("token", token);
    if (error)
      throw new Error(
        "Could not unregister this device. Try signing out again.",
      );
  }
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (user) await AsyncStorage.removeItem(enabledKey(user.id));
  await AsyncStorage.removeItem(DEVICE_KEY);
}
export function observeMessageAlerts(open: (id: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse) => {
    const id = response.notification.request.content.data?.messageId;
    if (typeof id === "string") {
      open(id);
      void Notifications.clearLastNotificationResponseAsync();
    }
  };
  const last = Notifications.getLastNotificationResponse();
  if (last) handle(last);
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
