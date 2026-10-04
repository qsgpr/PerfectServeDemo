import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Appearance,
  Platform,
  useColorScheme,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  Preferences,
} from "./preferences-model";
export const lightColors = {
  ink: "#192F39",
  muted: "#596D73",
  teal: "#176453",
  paper: "#F7F8F4",
  line: "#DEE5DF",
  white: "#FFFFFF",
  soft: "#EDF2EC",
  tinted: "#EDF0E4",
  accentSoft: "#E3EEE5",
  hero: "#192F39",
  onAccent: "#FFFFFF",
  danger: "#9B352C",
  urgentBg: "#F9E8DF",
  urgentInk: "#914421",
  plum: "#681338",
  linen: "#F6F2EE",
};
export type Colors = typeof lightColors;
const darkColors: Colors = {
  ink: "#E5F0ED",
  muted: "#A9BCB6",
  teal: "#8EDCC1",
  paper: "#101B1B",
  line: "#344542",
  white: "#1A2929",
  soft: "#243C35",
  tinted: "#27342C",
  accentSoft: "#28453C",
  hero: "#172F39",
  onAccent: "#102A22",
  danger: "#FFB1A5",
  urgentBg: "#442D27",
  urgentInk: "#FFBD99",
  plum: "#F2B6DE",
  linen: "#101B1B",
};
interface Theme {
  colors: Colors;
  dark: boolean;
  preferences: Preferences;
  reducedMotion: boolean;
  storageError: string | null;
  update: (patch: Partial<Preferences>) => void;
  feedback: () => void;
}
const Context = createContext<Theme | null>(null);
const KEY = "shiftline.preferences.v1";
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [systemReducedMotion, setSystemReducedMotion] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const current = useRef(DEFAULT_PREFERENCES);
  const touched = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (active && !touched.current) {
          const value = parsePreferences(raw);
          current.current = value;
          setPreferences(value);
        }
      })
      .catch(() => {
        if (active) setStorageError("Preferences could not be restored.");
      });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setSystemReducedMotion(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setSystemReducedMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web")
      Appearance.setColorScheme(
        preferences.mode === "system" ? "unspecified" : preferences.mode,
      );
  }, [preferences.mode]);
  const dark =
    preferences.mode === "dark" ||
    (preferences.mode === "system" && system === "dark");
  const update = (patch: Partial<Preferences>) => {
    touched.current = true;
    const value = { ...current.current, ...patch };
    current.current = value;
    setPreferences(value);
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(KEY, JSON.stringify(value)))
      .then(() => setStorageError(null))
      .catch(() =>
        setStorageError(
          "Preferences work for this session, but could not be saved.",
        ),
      );
  };
  const feedback = () => {
    if (preferences.haptics && Platform.OS !== "web")
      void Haptics.selectionAsync().catch(() => {});
  };
  return (
    <Context.Provider
      value={{
        colors: dark ? darkColors : lightColors,
        dark,
        preferences,
        reducedMotion: preferences.reduceMotion || systemReducedMotion,
        storageError,
        update,
        feedback,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTheme() {
  const value = useContext(Context);
  if (!value) throw new Error("useTheme requires PreferencesProvider");
  return value;
}
