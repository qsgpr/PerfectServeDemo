import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptRecoveryLink,
  parseRecoveryLink,
  recoveryRedirect,
  validateNewPassword,
  validateRecoveryEmail,
} from "../src/features/auth/password-recovery";

describe("password recovery", () => {
  it("validates email and matching passwords without changing their contents", () => {
    expect(validateRecoveryEmail(" ")).toContain("email");
    expect(validateRecoveryEmail("invalid")).toContain("valid");
    expect(validateRecoveryEmail(" cmartinez@example.com ")).toBeUndefined();
    expect(validateNewPassword("short", "short")).toContain("8");
    expect(validateNewPassword("long-password", "different")).toContain(
      "match",
    );
    expect(validateNewPassword("x".repeat(129), "x".repeat(129))).toContain(
      "128",
    );
    expect(
      validateNewPassword("long-password ", "long-password "),
    ).toBeUndefined();
  });
  it("uses the web origin and discards unrelated paths and query strings", () => {
    expect(recoveryRedirect("https://example.com/login?next=/inbox")).toBe(
      "https://example.com/reset-password",
    );
    expect(() => recoveryRedirect("shiftline://login")).toThrow("web app");
  });
  it("accepts supported callbacks but rejects unrelated sessions and expired links", () => {
    expect(
      parseRecoveryLink(
        "https://example.com/reset-password#type=recovery&access_token=access&refresh_token=refresh",
      ),
    ).toEqual({
      kind: "session",
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(
      parseRecoveryLink("https://example.com/reset-password?code=code"),
    ).toEqual({ kind: "code", code: "code" });
    expect(
      parseRecoveryLink(
        "https://example.com/reset-password?type=recovery&token_hash=hash",
      ),
    ).toEqual({ kind: "otp", tokenHash: "hash" });
    for (const suffix of [
      "",
      "#type=signup&access_token=access&refresh_token=refresh",
      "#type=recovery&access_token=access",
      "#error=access_denied",
    ]) {
      expect(() =>
        parseRecoveryLink("https://example.com/reset-password" + suffix),
      ).toThrow();
    }
  });
  it("verifies callbacks with the auth server and does not accept an absent session", async () => {
    const auth = {
      setSession: vi
        .fn()
        .mockResolvedValue({
          data: { session: { user: { id: "viewer" } } },
          error: null,
        }),
      exchangeCodeForSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      verifyOtp: vi
        .fn()
        .mockResolvedValue({
          data: { session: null },
          error: { message: "Expired" },
        }),
    } as unknown as SupabaseClient["auth"];
    await acceptRecoveryLink(auth, {
      kind: "session",
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(auth.setSession).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
    await expect(
      acceptRecoveryLink(auth, { kind: "code", code: "code" }),
    ).rejects.toThrow("expired");
    await expect(
      acceptRecoveryLink(auth, { kind: "otp", tokenHash: "hash" }),
    ).rejects.toThrow("expired");
  });
});
