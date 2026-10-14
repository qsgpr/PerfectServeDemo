export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STEPS = [
  {
    icon: "layers",
    title: "Your team, connected.",
    subtitle: "A quick introduction to Shiftline.",
    body: "Find your team, check coverage, and keep conversations moving. You can skip this tour and come back anytime from Settings.",
    hint: "Your profile button opens Settings.",
  },
  {
    icon: "users",
    title: "Find the right person.",
    subtitle: "Directory",
    body: "Search by name, role, or specialty. Open a teammate’s profile or tap Message to start a conversation with them already selected.",
    hint: "Use Message a department to reach the covering team.",
  },
  {
    icon: "calendar",
    title: "Know who’s covering.",
    subtitle: "Home & Schedule",
    body: "Home shows current on-call coverage. Schedule lets you explore the calendar and daily assignments, then contact the person on call.",
    hint: "On-call coverage follows the current time.",
  },
  {
    icon: "message-circle",
    title: "Keep the conversation moving.",
    subtitle: "Inbox",
    body: "Send a message, attach a photo, and follow read receipts. Choose Urgent when you need to highlight priority. Resolve finished conversations to keep your inbox clear.",
    hint: "The filter button keeps inbox controls out of the way.",
  },
  {
    icon: "cpu",
    title: "Meet Nova.",
    subtitle: "Your AI teammate",
    body: "Find Nova in the directory and ask about your shifts, team coverage, or a message you’re drafting. Nova uses your signed-in context. Resolve a conversation when you want a fresh start.",
    hint: "Review AI answers before relying on them.",
  },
] as const;
/** A missing flag belongs to an existing account; do not force a new tour on it. */
export function needsOnboarding(version?: number): boolean {
  return version === 0;
}
export function readOnboardingVersion(value: unknown): number | undefined {
  return value === 0 || value === ONBOARDING_VERSION ? value : undefined;
}
