import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthService,
  createDemoAuthService,
  DemoSession,
} from "./auth-service";
import { supabase } from "../../data/supabase";
import { unregisterMessageAlerts } from "../notifications/message-alerts";
import type { Session } from "@supabase/supabase-js";
const service = createDemoAuthService();
export const SESSION_KEY = "shiftline.session.v1";
interface AuthState {
  session: DemoSession | null;
  ready: boolean;
  cloud: boolean;
  storageError: string | null;
  signIn: AuthService["signIn"];
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
function account(session: Session | null): DemoSession | null {
  return session
    ? {
        id: session.user.id,
        name: session.user.user_metadata.name ?? "Teammate",
        email: session.user.email ?? "",
      }
    : null;
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (supabase) {
      const client = supabase;
      let changed = false;
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, value) => {
        changed = true;
        if (active) {
          setSession(account(value));
          setReady(true);
        }
      });
      void client.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active || changed) return;
          if (error) setStorageError(error.message);
          setSession(account(data.session));
          setReady(true);
        })
        .catch(() => {
          if (active) {
            setStorageError("Unable to restore sign-in.");
            setReady(true);
          }
        });
      if (Platform.OS !== "web") client.auth.startAutoRefresh();
      const app = AppState.addEventListener("change", (state) => {
        if (state === "active") client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
      });
      return () => {
        active = false;
        subscription.unsubscribe();
        app.remove();
        client.auth.stopAutoRefresh();
      };
    }
    AsyncStorage.getItem(SESSION_KEY)
      .then((raw) => {
        if (!raw || !active) return;
        const value = JSON.parse(raw);
        if (
          value.id === "demo-user" &&
          value.name === "Alex Morgan" &&
          value.email === "alex@shiftline.example"
        )
          setSession(value);
      })
      .catch(() => {
        if (active)
          setStorageError("Your saved sign-in could not be restored.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        session,
        ready,
        cloud: !!supabase,
        storageError,
        signIn: async (email, password) => {
          if (supabase) {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (error) throw new Error(error.message);
            const next = account(data.session);
            if (!next) throw new Error("Sign-in did not complete.");
            setSession(next);
            setStorageError(null);
            return next;
          }
          const next = await service.signIn(email, password);
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
          setSession(next);
          setStorageError(null);
          return next;
        },
        signUp: async (email, password, name) => {
          if (!supabase)
            throw new Error("Account creation requires a configured backend.");
          if (!name.trim() || name.trim().length > 100)
            throw new Error("Enter a name of up to 100 characters.");
          if (password.length < 8)
            throw new Error("Use at least 8 password characters.");
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { name: name.trim() } },
          });
          if (error) throw new Error(error.message);
          if (data.session) setSession(account(data.session));
          return !!data.session;
        },
        signOut: async () => {
          try {
            if (supabase) {
              await unregisterMessageAlerts();
              const { error } = await supabase.auth.signOut({ scope: "local" });
              if (error) throw error;
            } else await AsyncStorage.removeItem(SESSION_KEY);
            setSession(null);
            setStorageError(null);
          } catch {
            setStorageError("Sign-out could not be saved. Please try again.");
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
