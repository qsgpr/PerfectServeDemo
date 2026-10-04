import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CLOCK_KEY } from "../data/local-service";
import { createAppClock } from "../domain/clock";

// Use real time by default. Hidden tools can persist an explicit fictional override.
export function useAppClock() {
  const [clockIndex, setClockIndex] = useState(0);
  const [clock] = useState(createAppClock);
  const [isLiveClock, setIsLiveClock] = useState(true);
  const [now, setNow] = useState(clock.now);
  // Coverage uses this live clock even when the presentation clock is overridden.
  const [realNow, setRealNow] = useState(() => new Date().toISOString());
  const clockWrites = useRef(Promise.resolve());
  const [error, setError] = useState<string | null>(null);
  const restoreClock = useCallback(
    (index: number) => {
      clock.set(index);
      setClockIndex(index < 0 ? 0 : index);
      setIsLiveClock(index < 0);
      setNow(clock.now());
    },
    [clock],
  );
  const setClock = useCallback(
    (index: number) => {
      restoreClock(index);
      clockWrites.current = clockWrites.current
        .then(() => AsyncStorage.setItem(CLOCK_KEY, String(index)))
        .then(() => setError(null))
        .catch(() =>
          setError("The selected shift could not be saved. Please retry."),
        );
    },
    [restoreClock],
  );
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(clock.now());
      setRealNow(new Date().toISOString());
      // Align to minute boundaries so a 07:00/19:00 handoff changes on time.
      timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    };
    timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(clock.now());
        setRealNow(new Date().toISOString());
      }
    });
    return () => {
      clearTimeout(timer);
      app.remove();
    };
  }, [clock, isLiveClock]);
  return {
    clock,
    clockIndex,
    demoNow: now,
    realNow,
    isLiveClock,
    restoreClock,
    setClock,
    error,
  };
}
