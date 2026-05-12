/**
 * Supabase native phone-OTP wiring (ADR-0004).
 *
 * Thin wrappers over `@supabase/supabase-js` that surface the four outcomes
 * the Login reducer cares about: `ok`, `network`, `rate_limited`, `error`.
 * Greek-first error copy is rendered by the screen against the reducer's
 * `errorCode`; this module keeps the network shape stable so the reducer
 * test set never touches the SDK.
 *
 * No phone number is ever logged here (ADR-0004 §5 / ADR-0002 §6).
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SignInOutcome =
  | { kind: "ok" }
  | { kind: "network" }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "error" };

export type VerifyOutcome =
  | { kind: "ok"; accessToken: string; refreshToken: string }
  | { kind: "wrong" }
  | { kind: "expired" }
  | { kind: "network" }
  | { kind: "error" };

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let client: SupabaseClient | null = null;

export function getSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (client) return client;
  client = createClient(config.url, config.anonKey, {
    auth: {
      // 14-day refresh per ADR-0004 §4 (shortened from Supabase default 30d).
      // Supabase honors this on the project side; we record the intent here.
      autoRefreshToken: true,
      persistSession: true,
    },
  });
  return client;
}

/** Reset the cached client (tests + manual sign-out). */
export function resetSupabaseClientForTests(): void {
  client = null;
}

/** Send the OTP via Supabase. */
export async function sendOtp(
  supabase: SupabaseClient,
  phone: string
): Promise<SignInOutcome> {
  try {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (!error) return { kind: "ok" };
    // eslint-disable-next-line no-console
    console.warn("[auth.sendOtp]", error.message);
    if (isRateLimitError(error.message)) {
      return { kind: "rate_limited", retryAfterSeconds: 30 };
    }
    if (isNetworkError(error.message)) return { kind: "network" };
    return { kind: "error" };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[auth.sendOtp] threw:", err);
    if (isNetworkError(messageOf(err))) return { kind: "network" };
    return { kind: "error" };
  }
}

/** Verify the typed code and return the session tokens on success. */
export async function verifyOtp(
  supabase: SupabaseClient,
  phone: string,
  code: string
): Promise<VerifyOutcome> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    if (!error && data.session) {
      return {
        kind: "ok",
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
    }
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("expired")) return { kind: "expired" };
      if (isNetworkError(msg)) return { kind: "network" };
      return { kind: "wrong" };
    }
    return { kind: "wrong" };
  } catch (err) {
    if (isNetworkError(messageOf(err))) return { kind: "network" };
    return { kind: "error" };
  }
}

function messageOf(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message ?? "");
  }
  return "";
}

function isNetworkError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout") ||
    lower.includes("offline")
  );
}

function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return lower.includes("rate") || lower.includes("429") || lower.includes("too many");
}
