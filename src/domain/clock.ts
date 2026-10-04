export const CLOCK_PRESETS = [
  { label: "Day shift", at: "2026-10-01T10:00:00Z" },
  { label: "Evening shift", at: "2026-10-01T19:00:00Z" },
  { label: "Next morning", at: "2026-10-02T07:00:00Z" },
] as const;
export function nextClockIndex(index: number) {
  return (index + 1) % CLOCK_PRESETS.length;
}

export function createDemoClock() {
  let at: string = CLOCK_PRESETS[0].at;
  return {
    now: () => at,
    set: (index: number) => {
      at = CLOCK_PRESETS[index].at;
    },
  };
}

// An injectable time source keeps clock behavior testable without waiting in real time.
export function createAppClock(realNow = () => new Date().toISOString()) {
  const fictional = createDemoClock();
  let live = true;
  return {
    now: () => (live ? realNow() : fictional.now()),
    set: (index: number) => {
      live = index < 0;
      if (!live) fictional.set(index);
    },
  };
}
