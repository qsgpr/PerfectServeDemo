import { useEffect } from "react";
import { Platform } from "react-native";
import { notifyWebsiteVisit } from "./website-visit";

let started = false;

export function useWebsiteVisitAlert() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || started)
      return;
    started = true;
    // Read storage lazily because even accessing localStorage can throw.
    const storage = {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) =>
        window.localStorage.setItem(key, value),
    };
    void notifyWebsiteVisit({
      hostname: window.location.hostname,
      userAgent: window.navigator.userAgent,
      storage,
    });
  }, []);
}
