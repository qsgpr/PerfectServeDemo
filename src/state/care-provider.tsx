import React, { createContext, useContext, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CareService } from "../data/care-service";
import type {
  ChatInput,
  DemoAction,
  Message,
  MessageDraft,
  Snapshot,
} from "../domain/types";
import {
  nextClockIndex,
  type SimulationState,
} from "../features/presentation/simulation";
import { createPersistentService } from "../data/local-service";
import { useAuth } from "../features/auth/auth-provider";
import { useTheme } from "../theme/theme-provider";
import { supabase } from "../data/supabase";
import { createCloudService } from "../data/cloud-service";
import { useAppClock } from "./use-app-clock";
import { useCareSnapshot } from "./use-care-snapshot";
import { useMessagePlayback } from "./use-message-playback";
import { usePresentationTour, type Tour } from "./use-presentation-tour";
import { usePlaybackLifecycle } from "./use-playback-lifecycle";
export type { Tour } from "./use-presentation-tour";
interface Store {
  data: Snapshot | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  resolve: (id: string) => Promise<Message>;
  send: (draft: MessageDraft, requestId: string) => Promise<Message>;
  post: (id: string, input: ChatInput, requestId: string) => Promise<Message>;
  act: (id: string, action: DemoAction) => Promise<Message>;
  clockIndex: number;
  demoNow: string;
  realNow: string;
  isLiveClock: boolean;
  resetClock: () => void;
  advanceClock: () => void;
  simulations: Record<string, SimulationState>;
  simulate: (id: string, mode: "reply" | "escalation") => void;
  stopSimulation: (id: string) => void;
  retryAI: (id: string) => void;
  tour: Tour;
  startTour: () => void;
  stopTour: () => void;
}
const Context = createContext<Store | null>(null);
// Compose focused hooks here. Screens depend on this public API, not adapter internals.
export function CareProvider({
  children,
  service: suppliedService,
}: {
  children: React.ReactNode;
  service?: CareService;
}) {
  const { preferences, feedback } = useTheme();
  const { session } = useAuth();
  const {
    clock,
    clockIndex,
    demoNow,
    realNow,
    isLiveClock,
    restoreClock,
    setClock,
    error: clockError,
  } = useAppClock();
  const cloudService = useMemo(
    () =>
      supabase && session ? createCloudService(supabase, session.id) : null,
    [session],
  );
  const [localService] = useState(() =>
    createPersistentService(AsyncStorage, clock.now),
  );
  const service = suppliedService ?? cloudService ?? localService;
  const { data, loading, error, reload, merge } = useCareSnapshot(
    service,
    restoreClock,
    !!cloudService,
    session?.id,
  );
  const {
    simulations,
    runner,
    stopAI,
    startAI,
    simulate,
    stopSimulation,
    retryAI,
    clearSimulation,
  } = useMessagePlayback(service, data, clockIndex, merge, feedback, session);
  const { tour, tourJob, startTour, stopTour } = usePresentationTour(
    data,
    service,
    runner,
    setClock,
    merge,
    feedback,
  );
  usePlaybackLifecycle(runner, stopAI, stopTour, tourJob);
  return (
    <Context.Provider
      value={{
        data,
        loading,
        error: error ?? clockError,
        reload,
        clockIndex,
        demoNow,
        realNow,
        isLiveClock,
        resetClock: () => {
          if (tour.status !== "running") setClock(-1);
        },
        advanceClock: () => {
          if (tour.status !== "running") {
            setClock(nextClockIndex(clockIndex));
            feedback();
          }
        },
        resolve: async (id) => {
          stopAI(id);
          runner.stop(id, false);
          const message = await service.resolve(id);
          merge(message);
          feedback();
          return message;
        },
        simulations,
        simulate,
        stopSimulation,
        retryAI,
        tour,
        startTour,
        stopTour,
        send: async (draft, key) => {
          const message = await service.send(draft, key);
          merge(message);
          feedback();
          if (
            data?.team.find((m) => m.id === message.recipientId)?.kind === "ai"
          )
            startAI(message);
          else if (
            preferences.autoReply &&
            message.status !== "Replied" &&
            !data?.team.find((m) => m.id === message.recipientId)?.userId
          )
            runner.start(message.id, "reply");
          return message;
        },
        post: async (id, input, key) => {
          if (input.kind !== "call") {
            stopAI(id);
            runner.stop(id);
          }
          const message = await service.post(id, input, key);
          if (input.kind !== "call") clearSimulation(id);
          merge(message);
          feedback();
          if (
            input.kind !== "call" &&
            data?.team.find((m) => m.id === message.recipientId)?.kind === "ai"
          )
            startAI(message);
          else if (
            preferences.autoReply &&
            input.kind !== "call" &&
            !data?.team.find((m) => m.id === message.recipientId)?.userId
          )
            runner.start(id, "reply");
          return message;
        },
        act: async (id, action) => {
          const current = data?.messages.find((m) => m.id === id);
          if (
            current &&
            action === "reply" &&
            data?.team.find((m) => m.id === current.recipientId)?.kind === "ai"
          ) {
            startAI(current);
            return current;
          }
          runner.stop(id);
          const message = await service.act(id, action);
          merge(message);
          feedback();
          return message;
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCare() {
  const value = useContext(Context);
  if (!value) throw new Error("useCare requires CareProvider");
  return value;
}
