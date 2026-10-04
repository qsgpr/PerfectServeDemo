import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../features/auth/auth-provider";
export function useSavedDraft<T>(
  baseKey: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const { session, cloud } = useAuth();
  const key = cloud ? baseKey + "." + (session?.id ?? "signed-out") : baseKey;
  const initialRef = useRef(initial);
  const validateRef = useRef(validate);
  const [value, setValue] = useState(initial);
  const current = useRef(initial);
  const touched = useRef(false);
  const writes = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active || touched.current || !raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (validateRef.current(parsed)) {
          current.current = parsed;
          setValue(parsed);
        }
      })
      .catch(() => {
        if (active) setError("Draft could not be restored.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  const update = (patch: Partial<T>) => {
    touched.current = true;
    const next = { ...current.current, ...patch };
    current.current = next;
    setValue(next);
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(key, JSON.stringify(next)))
      .then(() => setError(""))
      .catch(() => setError("Draft could not be saved on this device."));
  };
  const clear = async () => {
    touched.current = true;
    current.current = initialRef.current;
    setValue(initialRef.current);
    await writes.current;
    try {
      await AsyncStorage.removeItem(key);
      setError("");
    } catch {
      setError("Draft could not be cleared.");
    }
  };
  return { value, update, clear, ready, error };
}
