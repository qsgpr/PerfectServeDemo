import { useCallback, useRef, useState } from "react";
import { coverage, type CareService } from "../data/care-service";
import {
  CLOCK_PRESETS,
  type SimulationRunner,
} from "../features/presentation/simulation";
import type { Message, Snapshot } from "../domain/types";
export interface Tour {
  status: "idle" | "running" | "complete" | "stopped" | "error";
  seconds: number;
  messageId?: string;
  error?: string;
}
// Schedules the hidden walkthrough without putting timers in screen components.
export function usePresentationTour(
  data: Snapshot | null,
  service: CareService,
  runner: SimulationRunner,
  setClock: (index: number) => void,
  merge: (message: Message) => void,
  feedback: () => void,
) {
  const [tour, setTour] = useState<Tour>({ status: "idle", seconds: 0 });
  const tourJob = useRef<{
    cancelled: boolean;
    controller: AbortController;
    timers: Set<ReturnType<typeof setTimeout>>;
    messageId?: string;
  } | null>(null);
  const stopTour = useCallback(() => {
    const job = tourJob.current;
    if (!job || job.cancelled) return;
    job.cancelled = true;
    job.controller.abort();
    job.timers.forEach(clearTimeout);
    if (job.messageId) runner.stop(job.messageId);
    setTour((previous) => ({
      ...previous,
      status: previous.status === "complete" ? "complete" : "stopped",
    }));
  }, [runner]);
  const startTour = () => {
    if (!data || (tourJob.current && !tourJob.current.cancelled)) return;
    runner.stopAll();
    setClock(0);
    feedback();
    const job = {
      cancelled: false,
      controller: new AbortController(),
      timers: new Set<ReturnType<typeof setTimeout>>(),
      messageId: undefined as string | undefined,
    };
    tourJob.current = job;
    setTour({ status: "running", seconds: 0 });
    const after = (ms: number, fn: () => Promise<void> | void) => {
      const timer = setTimeout(() => {
        job.timers.delete(timer);
        if (!job.cancelled)
          void Promise.resolve()
            .then(fn)
            .catch((e) => {
              if (!job.cancelled) {
                stopTour();
                setTour((previous) => ({
                  ...previous,
                  status: "error",
                  error:
                    e instanceof Error
                      ? e.message
                      : "Walkthrough failed. Try again.",
                }));
              }
            });
      }, ms);
      job.timers.add(timer);
    };
    for (let second = 1; second <= 60; second++)
      after(second * 1000, () =>
        setTour((previous) => ({ ...previous, seconds: second })),
      );
    after(8000, () => setClock(1));
    after(16000, async () => {
      const recipientId = coverage(data.shifts, CLOCK_PRESETS[1].at).current
        ?.memberId;
      if (!recipientId)
        throw new Error("No coverage is available for this shift.");
      const message = await service.send(
        {
          recipientId,
          subject: "Evening handoff",
          body: "Please review the evening handoff and confirm coverage with the team.",
          priority: "Urgent",
        },
        `tour-${Date.now()}`,
        job.controller.signal,
      );
      if (job.cancelled) return;
      merge(message);
      job.messageId = message.id;
      setTour((previous) => ({ ...previous, messageId: message.id }));
    });
    after(22000, () => {
      if (job.messageId) runner.start(job.messageId, "escalation");
    });
    after(46000, () => {
      if (job.messageId) runner.start(job.messageId, "reply");
    });
    after(60000, () => {
      job.cancelled = true;
      setTour((previous) => ({ ...previous, status: "complete", seconds: 60 }));
    });
  };
  return { tour, tourJob, startTour, stopTour };
}
