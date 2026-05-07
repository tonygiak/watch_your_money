/**
 * Profile screen state machine (DES-0004 §2 / BLG-0017).
 *
 * Pure-TS, framework-free. Drives the freelancer toggle, the ΑΦΜ field,
 * the date-pill / export pre-flight, and the sign-out flow.
 *
 * The state machine deliberately covers every transition listed in
 * DES-0004 §2 so the screen can render purely from `state.status` and the
 * effect layer (the screen) can decide which side-effects to fire.
 *
 * Side effects (PATCH `/users/me`, GET `/export/business-expenses`,
 * `supabase.auth.signOut()`, share sheet dispatch, cache key rotation,
 * navigation on `auth_error`) live in the screen — never in the reducer.
 */

import { validateAfm } from "../../lib/afm";

export type ProfileStatus =
  | "idle"
  | "editing_freelancer"
  | "editing_afm"
  | "pre_export"
  | "exporting"
  | "export_done"
  | "signing_out"
  | "auth_error";

export type ProfileValidationField = "afm" | "from_date" | "to_date";

export type ProfileValidationError = {
  field: ProfileValidationField;
  /** Localized message key, resolved by the screen via `t(...)`. */
  messageKey: string;
};

export type ProfileNetworkError = {
  /** Which control failed — the screen places the inline retry banner near it. */
  surface: "freelancer" | "afm" | "export";
  messageKey: string;
};

export type ProfileState = {
  status: ProfileStatus;

  /** User identity (read once on mount, refreshed after every successful PATCH). */
  userId: string;
  /** Phone number for **display only** — the screen masks it before render. */
  phone: string | null;
  /** Last successful sign-in timestamp (Athens TZ string from session). */
  lastSignInAt: string | null;

  /** Server-confirmed `is_freelancer`. */
  isFreelancer: boolean;
  /** Server-confirmed ΑΦΜ. `null` until set. */
  afm: string | null;

  /** Local input value for the ΑΦΜ TextInput. Initialized from `afm` on mount. */
  afmInput: string;

  /** Optimistic-flip target for the freelancer toggle, while a PATCH is in flight. */
  pendingFreelancer: boolean | null;

  /** Export date range — ISO ``YYYY-MM-DD`` strings. Defaults to the current
   * Athens-TZ month (start → today) on mount per DES-0004 §3.4. */
  exportFromDate: string;
  exportToDate: string;

  validationError: ProfileValidationError | null;
  networkError: ProfileNetworkError | null;
};

export type ProfileAction =
  | {
      type: "INIT";
      userId: string;
      phone: string | null;
      lastSignInAt: string | null;
      isFreelancer: boolean;
      afm: string | null;
    }
  | { type: "FREELANCER_TOGGLE_TAPPED" }
  | { type: "FREELANCER_PATCH_OK"; isFreelancer: boolean; afm: string | null }
  | { type: "FREELANCER_PATCH_NETWORK_ERROR" }
  | { type: "AFM_INPUT_CHANGED"; value: string }
  | { type: "AFM_SAVE_TAPPED" }
  | { type: "AFM_PATCH_OK"; afm: string | null }
  | {
      type: "AFM_PATCH_VALIDATION_ERROR";
      messageKey: string;
    }
  | { type: "AFM_PATCH_NETWORK_ERROR" }
  | { type: "EXPORT_FROM_CHANGED"; value: string }
  | { type: "EXPORT_TO_CHANGED"; value: string }
  | { type: "EXPORT_GENERATE_TAPPED" }
  | { type: "EXPORT_DONE" }
  | { type: "EXPORT_VALIDATION_ERROR"; field: "from_date" | "to_date"; messageKey: string }
  | { type: "EXPORT_NETWORK_ERROR" }
  | { type: "SIGN_OUT_TAPPED" }
  | { type: "AUTH_ERROR" };

export const AFM_MAX_INPUT_LEN = 9;
export const EXPORT_MAX_RANGE_DAYS = 366;

export function initialProfileState(args: {
  userId: string;
  phone: string | null;
  lastSignInAt: string | null;
  isFreelancer: boolean;
  afm: string | null;
  /** Optional override; defaults to the current calendar day (UTC). */
  now?: Date;
}): ProfileState {
  const now = args.now ?? new Date();
  return {
    status: "idle",
    userId: args.userId,
    phone: args.phone,
    lastSignInAt: args.lastSignInAt,
    isFreelancer: args.isFreelancer,
    afm: args.afm,
    afmInput: args.afm ?? "",
    pendingFreelancer: null,
    exportFromDate: formatIsoDate(firstOfMonth(now)),
    exportToDate: formatIsoDate(now),
    validationError: null,
    networkError: null,
  };
}

export function profileReducer(
  state: ProfileState,
  action: ProfileAction
): ProfileState {
  switch (action.type) {
    case "INIT":
      return initialProfileState({
        userId: action.userId,
        phone: action.phone,
        lastSignInAt: action.lastSignInAt,
        isFreelancer: action.isFreelancer,
        afm: action.afm,
      });

    case "FREELANCER_TOGGLE_TAPPED": {
      // Optimistic flip; PATCH fires from the screen.
      const target = !state.isFreelancer;
      return {
        ...state,
        status: "editing_freelancer",
        pendingFreelancer: target,
        // Clear any stale errors — a user retry should feel fresh.
        networkError: null,
      };
    }

    case "FREELANCER_PATCH_OK":
      return {
        ...state,
        status: "idle",
        isFreelancer: action.isFreelancer,
        // Server-side invariant: toggling off does NOT clear ΑΦΜ. We trust
        // the response.
        afm: action.afm,
        pendingFreelancer: null,
      };

    case "FREELANCER_PATCH_NETWORK_ERROR":
      // Revert the optimistic flip — show the previous truth.
      return {
        ...state,
        status: "idle",
        pendingFreelancer: null,
        networkError: {
          surface: "freelancer",
          messageKey: "profile.afm.network_error",
        },
      };

    case "AFM_INPUT_CHANGED":
      // Cap at 9 chars (the input cap; the validator rejects non-9 anyway)
      // so the user can't paste a giant string.
      return {
        ...state,
        afmInput: action.value.slice(0, AFM_MAX_INPUT_LEN),
        validationError: null,
      };

    case "AFM_SAVE_TAPPED": {
      // Local validation BEFORE we burn a PATCH on garbage input.
      const result = validateAfm(state.afmInput);
      if (!result.ok) {
        const messageKey = afmReasonToMessageKey(result.reason);
        return {
          ...state,
          validationError: { field: "afm", messageKey },
        };
      }
      return {
        ...state,
        status: "editing_afm",
        validationError: null,
        networkError: null,
      };
    }

    case "AFM_PATCH_OK":
      return {
        ...state,
        status: "idle",
        afm: action.afm,
        afmInput: action.afm ?? "",
        validationError: null,
      };

    case "AFM_PATCH_VALIDATION_ERROR":
      // Server returned 422 — surface it. Stays in `idle` so the user can
      // edit again immediately.
      return {
        ...state,
        status: "idle",
        validationError: { field: "afm", messageKey: action.messageKey },
      };

    case "AFM_PATCH_NETWORK_ERROR":
      return {
        ...state,
        status: "idle",
        networkError: {
          surface: "afm",
          messageKey: "profile.afm.network_error",
        },
      };

    case "EXPORT_FROM_CHANGED":
      return {
        ...state,
        exportFromDate: action.value,
        validationError: null,
        networkError: null,
      };

    case "EXPORT_TO_CHANGED":
      return {
        ...state,
        exportToDate: action.value,
        validationError: null,
        networkError: null,
      };

    case "EXPORT_GENERATE_TAPPED": {
      // Local validation BEFORE we hit the network — same rules as the
      // server (ADR-0009 §2). Mirrors the BLG-0019 backend code.
      const from = parseIsoDate(state.exportFromDate);
      const to = parseIsoDate(state.exportToDate);
      if (!from) {
        return {
          ...state,
          validationError: {
            field: "from_date",
            messageKey: "profile.export.range_invalid",
          },
        };
      }
      if (!to) {
        return {
          ...state,
          validationError: {
            field: "to_date",
            messageKey: "profile.export.range_invalid",
          },
        };
      }
      if (to.getTime() < from.getTime()) {
        return {
          ...state,
          validationError: {
            field: "to_date",
            messageKey: "profile.export.range_invalid",
          },
        };
      }
      const days = Math.round(
        (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (days > EXPORT_MAX_RANGE_DAYS) {
        return {
          ...state,
          validationError: {
            field: "to_date",
            messageKey: "profile.export.range_too_long",
          },
        };
      }
      return {
        ...state,
        status: "exporting",
        validationError: null,
        networkError: null,
      };
    }

    case "EXPORT_DONE":
      return { ...state, status: "idle" };

    case "EXPORT_VALIDATION_ERROR":
      return {
        ...state,
        status: "idle",
        validationError: { field: action.field, messageKey: action.messageKey },
      };

    case "EXPORT_NETWORK_ERROR":
      return {
        ...state,
        status: "idle",
        networkError: {
          surface: "export",
          messageKey: "profile.export.failed.network",
        },
      };

    case "SIGN_OUT_TAPPED":
      return { ...state, status: "signing_out" };

    case "AUTH_ERROR":
      return { ...state, status: "auth_error" };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function afmReasonToMessageKey(
  reason: "empty" | "non_numeric" | "wrong_length" | "all_zeros" | "checksum"
): string {
  // DES-0004 §3.3 keeps a single user-facing message ("Ο ΑΦΜ δεν είναι
  // έγκυρος") for every failure. The structured reason is for telemetry
  // (counts only), not for the UI.
  if (reason === "empty") return "profile.afm.required_for_freelancer";
  return "profile.afm.invalid";
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatIsoDate(d: Date): string {
  // Always render YYYY-MM-DD in the local TZ. The server interprets the
  // string as a calendar date (timezone-naive), which is what DES-0004
  // §3.4 specifies (Athens-TZ boundaries on the user's device).
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(s: string): Date | null {
  // Accept exactly ``YYYY-MM-DD``. Anything else is a validation error
  // surfaced by the reducer.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Mask the phone for §3.1 display: show only country code + last 4 digits. */
export function maskPhone(phone: string | null): string {
  if (!phone) return "";
  // Expect a +30 6XXXXXXXXX shape from DES-0002 §3 / Supabase. Greece-only
  // for MVP (`AGENTS.md` §2.9). Hard-code +30 so we never accidentally
  // greedy-match a country code into the mobile number.
  const tail = phone.slice(-4);
  if (phone.startsWith("+30")) {
    return `+30 6XX *** ${tail}`;
  }
  if (phone.startsWith("+")) {
    // Defensive fallback for non-+30 numbers — show the leading '+' and
    // the last 4 only.
    return `+** 6XX *** ${tail}`;
  }
  return `6XX *** ${tail}`;
}
