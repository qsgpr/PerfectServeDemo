import { useCallback, useMemo, useRef, useState } from "react";
import { canAct, type CareService } from "../data/care-service";
import {
  SimulationRunner,
  type SimulationState,
} from "../features/presentation/simulation";
import { aiRequest, requestAI } from "../features/assistant/ai-client";
import { buildAIContext } from "../features/assistant/ai-context";
import { aiEndpoint } from "../features/assistant/ai-endpoint";
import { chatEntries } from "../domain/chat";
import type { Message, Snapshot } from "../domain/types";
import { supabase } from "../data/supabase";
// AI and fictional playback share cancellable jobs; registered teammates reply themselves.
export function useMessagePlayback(
  service: CareService,
  data: Snapshot | null,
  clockIndex: number,
  merge: (message: Message) => void,
  feedback: () => void,
  account: { id: string; name: string } | null,
) {
  const [simulations, setSimulations] = useState<
    Record<string, SimulationState>
  >({});
  const aiJobs = useRef(new Map<string, AbortController>());
  const stopAI = useCallback((id?: string, notify = true) => {
    const ids = id
      ? aiJobs.current.has(id)
        ? [id]
        : []
      : [...aiJobs.current.keys()];
    for (const key of ids) {
      aiJobs.current.get(key)?.abort();
      aiJobs.current.delete(key);
    }
    if (notify && ids.length)
      setSimulations((previous) => {
        const next = { ...previous };
        for (const key of ids) next[key] = { phase: "stopped" };
        return next;
      });
  }, []);
  const runner = useMemo(
    () =>
      new SimulationRunner(
        async (id, action, signal) => {
          const message = await service.act(id, action, signal);
          if (!signal?.aborted) merge(message);
        },
        (id, value) =>
          setSimulations((previous) => ({ ...previous, [id]: value })),
      ),
    [service, merge],
  );
  const startAI = (message: Message) => {
    const recipient = data?.team.find((m) => m.id === message.recipientId);
    if (
      recipient?.kind !== "ai" ||
      message.status === "Replied" ||
      message.resolvedAt
    )
      return;
    stopAI(message.id);
    runner.stop(message.id, false);
    const controller = new AbortController();
    aiJobs.current.set(message.id, controller);
    const timer = setTimeout(() => controller.abort(), 50000);
    const emit = (value: SimulationState) =>
      setSimulations((previous) => ({ ...previous, [message.id]: value }));
    emit({ phase: "typing" });
    const replyTo = chatEntries(message)
      .filter((e) => e.sender === "you" && e.kind !== "call")
      .at(-1)?.id;
    void (async () => {
      try {
        const session = supabase ? await supabase.auth.getSession() : null;
        const text = await requestAI(
          aiEndpoint(),
          aiRequest(
            message,
            clockIndex,
            buildAIContext(account, data, new Date().toISOString()),
          ),
          controller.signal,
          session?.data.session?.access_token,
        );
        if (controller.signal.aborted || !replyTo) return;
        const reply = await service.receive(
          message.id,
          text,
          replyTo,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          merge(reply);
          emit({ phase: "replied" });
        }
      } catch (e) {
        if (aiJobs.current.get(message.id) === controller)
          emit({
            phase: "error",
            error: controller.signal.aborted
              ? "AI took too long. Please retry."
              : e instanceof TypeError
                ? "Cannot reach the AI server. Check your connection and retry."
                : e instanceof Error
                  ? e.message
                  : "AI could not reply. Please retry.",
          });
      } finally {
        clearTimeout(timer);
        if (aiJobs.current.get(message.id) === controller)
          aiJobs.current.delete(message.id);
      }
    })();
  };
  const simulate = (id: string, mode: "reply" | "escalation") => {
    const message = data?.messages.find((m) => m.id === id);
    if (!message || !canAct(message, mode === "reply" ? "reply" : "escalate"))
      return;
    if (data?.team.find((m) => m.id === message.recipientId)?.kind === "ai") {
      if (mode === "reply") startAI(message);
      return;
    }
    runner.start(id, mode);
    feedback();
  };
  const stopSimulation = (id: string) => {
    stopAI(id);
    runner.stop(id);
    setSimulations((previous) => ({ ...previous, [id]: { phase: "stopped" } }));
  };
  const retryAI = (id: string) => {
    const message = data?.messages.find((m) => m.id === id);
    if (message) startAI(message);
  };
  const clearSimulation = (id: string) =>
    setSimulations((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  return {
    simulations,
    runner,
    stopAI,
    startAI,
    simulate,
    stopSimulation,
    retryAI,
    clearSimulation,
  };
}
