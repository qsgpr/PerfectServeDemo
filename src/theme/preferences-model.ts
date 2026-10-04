export interface Preferences {
  mode: "system" | "light" | "dark";
  autoReply: boolean;
  haptics: boolean;
  reduceMotion: boolean;
}
export const DEFAULT_PREFERENCES: Preferences = {
  mode: "system",
  autoReply: false,
  haptics: true,
  reduceMotion: false,
};
export function parsePreferences(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw ?? "{}");
    return {
      mode: ["system", "light", "dark"].includes(value?.mode)
        ? value.mode
        : "system",
      autoReply:
        typeof value?.autoReply === "boolean" ? value.autoReply : false,
      haptics: typeof value?.haptics === "boolean" ? value.haptics : true,
      reduceMotion:
        typeof value?.reduceMotion === "boolean" ? value.reduceMotion : false,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
