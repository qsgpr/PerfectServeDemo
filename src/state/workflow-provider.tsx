import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { useCare } from "./care-provider";
import { useAuth } from "../features/auth/auth-provider";
import { supabase } from "../data/supabase";
import {
  createCloudWorkflow,
  createLocalWorkflow,
  type WorkflowService,
} from "../data/workflow-service";
import type { WorkflowSnapshot } from "../domain/workflows";
type Store = WorkflowSnapshot & {
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  service: WorkflowService;
};
const Context = createContext<Store | null>(null);
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const care = useCare();
  const { session, cloud } = useAuth();
  const careRef = useRef(care);
  useEffect(() => {
    careRef.current = care;
  }, [care]);
  const id = session?.id ?? "signed-out";
  const localContext = useCallback(
    () => ({ data: careRef.current.data, send: careRef.current.send }),
    [],
  );
  const service = useMemo(
    () =>
      supabase && cloud
        ? createCloudWorkflow(supabase, id)
        : createLocalWorkflow(AsyncStorage, id),
    [cloud, id],
  );
  useEffect(() => {
    service.setLocalContext?.(localContext);
  }, [service, localContext]);
  const [data, setData] = useState<WorkflowSnapshot>({
    reachability: {},
    handoffs: [],
  });
  const [loading, setLoading] = useState(!!session);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await service.load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load handoffs.");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [service]);
  useEffect(() => {
    let active = true,
      running = false,
      queued = false;
    const sync = async () => {
      if (!active) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        do {
          queued = false;
          const snapshot = await service.load();
          if (active) {
            setData(snapshot);
            setError(null);
          }
        } while (active && queued);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Could not sync handoffs.");
      } finally {
        running = false;
        if (active) setLoading(false);
      }
    };
    if (session) void sync();
    const client = supabase;
    const channel =
      client && cloud && session
        ? client
            .channel("workflows-" + id)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "shiftline_reachability" },
              () => void sync(),
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "shiftline_handoffs" },
              () => void sync(),
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") void sync();
            })
        : null;
    const timer = session ? setInterval(() => void sync(), 10000) : null;
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active" && session) void sync();
    });
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      app.remove();
      if (channel) void client?.removeChannel(channel);
    };
  }, [service, cloud, id, session]);
  return (
    <Context.Provider value={{ ...data, loading, error, reload, service }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkflows() {
  const value = useContext(Context);
  if (!value) throw new Error("useWorkflows requires WorkflowProvider");
  return value;
}
