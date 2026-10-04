import { DemoAction } from "../../domain/types";
export type SimulationPhase =
  | "waiting"
  | "read"
  | "typing"
  | "replied"
  | "countdown"
  | "escalated"
  | "stopped"
  | "error";
export interface SimulationState {
  phase: SimulationPhase;
  remaining?: number;
  error?: string;
}
export const ESCALATION_SECONDS = 15;
/** One cancellable runner per message. All asynchronous continuations check the same token. */
export class SimulationRunner {
  private jobs = new Map<
    string,
    {
      cancelled: boolean;
      controller: AbortController;
      timers: Set<ReturnType<typeof setTimeout>>;
    }
  >();
  constructor(
    private act: (
      id: string,
      action: DemoAction,
      signal?: AbortSignal,
    ) => Promise<unknown>,
    private emit: (id: string, value: SimulationState) => void,
  ) {}
  stop(id: string, notify = true) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.cancelled = true;
    job.controller.abort();
    job.timers.forEach(clearTimeout);
    this.jobs.delete(id);
    if (notify) this.emit(id, { phase: "stopped" });
  }
  stopAll(notify = true) {
    [...this.jobs.keys()].forEach((id) => this.stop(id, notify));
  }
  start(id: string, mode: "reply" | "escalation") {
    this.stop(id, false);
    const job = {
      cancelled: false,
      controller: new AbortController(),
      timers: new Set<ReturnType<typeof setTimeout>>(),
    };
    this.jobs.set(id, job);
    const emit = (value: SimulationState) => {
      if (!job.cancelled) this.emit(id, value);
    };
    const after = (delay: number, fn: () => Promise<void> | void) => {
      const timer = setTimeout(() => {
        job.timers.delete(timer);
        if (!job.cancelled)
          void Promise.resolve()
            .then(fn)
            .catch((e) => {
              if (!job.cancelled) {
                emit({
                  phase: "error",
                  error:
                    e instanceof Error
                      ? e.message
                      : "Playback failed. Try again.",
                });
                this.stop(id, false);
              }
            });
      }, delay);
      job.timers.add(timer);
    };
    if (mode === "reply") {
      emit({ phase: "waiting" });
      after(2000, async () => {
        if (job.cancelled) return;
        await this.act(id, "read", job.controller.signal);
        if (job.cancelled) return;
        emit({ phase: "read" });
        after(1500, () => {
          emit({ phase: "typing" });
          after(3000, async () => {
            if (job.cancelled) return;
            await this.act(id, "reply", job.controller.signal);
            if (job.cancelled) return;
            emit({ phase: "replied" });
            this.stop(id, false);
          });
        });
      });
    } else {
      let remaining = ESCALATION_SECONDS;
      emit({ phase: "countdown", remaining });
      const tick = () =>
        after(1000, async () => {
          remaining--;
          emit({ phase: "countdown", remaining });
          if (remaining > 0) tick();
          else {
            if (job.cancelled) return;
            await this.act(id, "escalate", job.controller.signal);
            if (job.cancelled) return;
            emit({ phase: "escalated", remaining: 0 });
            this.stop(id, false);
          }
        });
      tick();
    }
  }
}
export function tourStep(seconds: number) {
  if (seconds < 8) return "1 of 5 · See who is on call";
  if (seconds < 16) return "2 of 5 · Watch the evening handoff";
  if (seconds < 38) return "3 of 5 · An urgent update awaits a reply";
  if (seconds < 46) return "4 of 5 · Escalation reaches the backup team";
  if (seconds < 60) return "5 of 5 · A teammate replies";
  return "Handoff complete · Your team is up to date";
}

export {
  CLOCK_PRESETS,
  nextClockIndex,
  createDemoClock,
} from "../../domain/clock";
