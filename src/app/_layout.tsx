import React, { useEffect } from "react";
import {
  router,
  usePathname,
  Stack,
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "expo-router";
import { LoadingSkeleton } from "../components/ui";
import { BackButton } from "../components/back-button";
import { AppHeader } from "../components/app-header";
import { IncomingNotice } from "../features/notifications/incoming-notice";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../features/auth/auth-provider";
import { WorkflowProvider } from "../state/workflow-provider";
import { CareProvider, useCare } from "../state/care-provider";
import { PreferencesProvider, useTheme } from "../theme/theme-provider";
import { needsOnboarding } from "../features/onboarding/onboarding-model";
function TourNavigation() {
  const { tour } = useCare();
  useEffect(() => {
    if (tour.messageId && tour.status === "running")
      router.navigate({
        pathname: "/conversation",
        params: { messageId: tour.messageId },
      });
  }, [tour.messageId, tour.status]);
  return null;
}
function Navigation() {
  const { session, ready, recoveryMode } = useAuth();
  const pathname = usePathname();
  const onboarding = !!session && needsOnboarding(session.onboardingVersion);
  useEffect(() => {
    if (ready && recoveryMode && pathname !== "/reset-password") {
      router.replace("/reset-password");
    } else if (
      ready &&
      !recoveryMode &&
      onboarding &&
      pathname !== "/onboarding"
    ) {
      router.replace("/onboarding");
    }
  }, [ready, recoveryMode, onboarding, pathname]);
  const { colors, dark } = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  if (!ready) return <LoadingSkeleton />;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: colors.paper,
          card: colors.white,
          text: colors.ink,
          border: colors.line,
          primary: colors.teal,
        },
      }}
    >
      <CareProvider
        key={recoveryMode ? "recovery" : (session?.id ?? "signed-out")}
      >
        <WorkflowProvider>
          <TourNavigation />
          <StatusBar style={dark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.paper },
              headerTintColor: colors.ink,
              headerShadowVisible: false,
              headerLeft: () => <BackButton />,
              headerBackVisible: false,
              contentStyle: { backgroundColor: colors.paper },
            }}
          >
            <Stack.Protected guard={!session && !recoveryMode}>
              <Stack.Screen name="login" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={!!session && !recoveryMode && !onboarding}>
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: true,
                  header: () => <AppHeader />,
                  title: "Your team",
                }}
              />
              <Stack.Screen
                name="departments"
                options={{ title: "Departments" }}
              />
              <Stack.Screen
                name="handoffs"
                options={{ title: "Shift handoff" }}
              />
              <Stack.Screen
                name="contact"
                options={{ title: "Contact profile" }}
              />
              <Stack.Screen name="settings" options={{ title: "Settings" }} />
              <Stack.Screen
                name="tools"
                options={{ title: "Presentation tools" }}
              />
              <Stack.Screen name="compose" options={{ title: "New message" }} />
              <Stack.Screen
                name="conversation"
                options={{ title: "Conversation", headerShown: false }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!!session && !recoveryMode}>
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
            </Stack.Protected>
            <Stack.Screen
              name="reset-password"
              options={{ headerShown: false }}
            />
          </Stack>
          {!!session && !onboarding && !recoveryMode && <IncomingNotice />}
        </WorkflowProvider>
      </CareProvider>
    </ThemeProvider>
  );
}
export default function RootLayout() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </PreferencesProvider>
  );
}
