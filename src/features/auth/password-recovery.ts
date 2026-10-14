import type { SupabaseClient } from "@supabase/supabase-js";

export function validateRecoveryEmail(email: string): string | undefined {
  if (!email.trim()) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Enter a valid email address.";
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8) return "Use at least 8 password characters.";
  if (password.length > 128) return "Use at most 128 password characters.";
  if (password !== confirmation) return "Your passwords do not match.";
}

export function recoveryRedirect(origin: string): string {
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Open password recovery in the web app.");
  return url.origin + "/reset-password";
}

export type RecoveryLink =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string }
  | { kind: "otp"; tokenHash: string };

export function parseRecoveryLink(href: string): RecoveryLink {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has("error") || url.searchParams.has("error"))
    throw new Error(
      "This reset link has expired or is invalid. Request a new one.",
    );
  if (hash.get("type") === "recovery") {
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken)
      return { kind: "session", accessToken, refreshToken };
  }
  const tokenHash = url.searchParams.get("token_hash");
  if (url.searchParams.get("type") === "recovery" && tokenHash)
    return { kind: "otp", tokenHash };
  const code = url.searchParams.get("code");
  if (code) return { kind: "code", code };
  throw new Error("Open the password reset link from your email to continue.");
}

export async function acceptRecoveryLink(
  auth: Pick<
    SupabaseClient["auth"],
    "setSession" | "exchangeCodeForSession" | "verifyOtp"
  >,
  link: RecoveryLink,
): Promise<void> {
  const result =
    link.kind === "session"
      ? await auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        })
      : link.kind === "code"
        ? await auth.exchangeCodeForSession(link.code)
        : await auth.verifyOtp({
            type: "recovery",
            token_hash: link.tokenHash,
          });
  if (result.error || !result.data.session)
    throw new Error(
      "This reset link has expired or is invalid. Request a new one.",
    );
}
