import { describe, expect, it } from "vitest";
import {
  needsOnboarding,
  readOnboardingVersion,
  ONBOARDING_STEPS,
} from "../src/features/onboarding/onboarding-model";
describe("onboarding", () => {
  it("offers new accounts a tour without forcing existing users to repeat it", () => {
    expect(needsOnboarding(0)).toBe(true);
    expect(needsOnboarding(1)).toBe(false);
    expect(needsOnboarding()).toBe(false);
  });
  it("ignores malformed stored preferences", () => {
    expect(readOnboardingVersion(0)).toBe(0);
    expect(readOnboardingVersion(1)).toBe(1);
    for (const value of [null, "0", true, -1, {}, 500])
      expect(readOnboardingVersion(value)).toBeUndefined();
  });
  it("covers the directory, coverage, conversations, and Nova", () => {
    expect(ONBOARDING_STEPS.map((step) => step.subtitle)).toEqual([
      "A quick introduction to Shiftline.",
      "Directory",
      "Home & Schedule",
      "Inbox",
      "Your AI teammate",
    ]);
  });
});
