import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import type { SimulationRunner } from "../features/presentation/simulation";
import type { usePresentationTour } from "./use-presentation-tour";
// One cleanup boundary stops pending AI, playback, and tour work on background/unmount.
export function usePlaybackLifecycle(
  runner: SimulationRunner,
  stopAI: (id?: string, notify?: boolean) => void,
  stopTour: () => void,
  tourJob: ReturnType<typeof usePresentationTour>["tourJob"],
) {
  useEffect(() => {
    const jobs = tourJob;
    const cancel = () => {
      stopAI();
      runner.stopAll();
      stopTour();
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel();
    });
    const visibility = () => {
      if (document.hidden) cancel();
    };
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", visibility);
    return () => {
      stopAI(undefined, false);
      runner.stopAll(false);
      const job = jobs.current;
      if (job) {
        job.cancelled = true;
        job.controller.abort();
        job.timers.forEach(clearTimeout);
      }
      subscription.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", visibility);
    };
  }, [runner, stopAI, stopTour, tourJob]);
}
