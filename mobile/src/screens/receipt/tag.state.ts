/**
 * Tag-as-business reducer (DES-0005 §2 / ADR-0008).
 *
 * Pure-TS, framework-free. Drives the inline tag panel on the receipt-
 * detail screen. The reducer captures every transition called out in
 * DES-0005 §2:
 *
 *   untagged_idle ──tap toggle on──► editing
 *   tagged_idle   ──tap row────────► editing (panel opens with category + notes pre-filled)
 *   tagged_idle   ──tap toggle off─► untagging (optimistic flip + POST)
 *   editing       ──Save tapped────► saving (optimistic UI; server fires)
 *   editing       ──Cancel─────────► previous idle (revert toggle if fresh tag)
 *   saving        ──server 200─────► tagged_idle
 *   saving        ──network error──► editing (preserve user's last input)
 *   saving        ──server 422─────► editing + field-level error
 *   untagging     ──server 200─────► untagged_idle
 *   untagging     ──network error──► tagged_idle (revert toggle)
 *   any           ──server 401─────► auth_error (terminal — navigate to Login)
 *
 * The reducer is pure: no API calls, no telemetry, no navigation. Side
 * effects (the actual `tagReceipt` POST, the toast, the navigation on
 * `auth_error`) are wired by the screen.
 */

export type TagStatus =
  | "untagged_idle"
  | "tagged_idle"
  | "editing"
  | "saving"
  | "untagging"
  | "auth_error";

export type TagValidationField = "category" | "notes";

export type TagValidationError = {
  field: TagValidationField;
  /** Localized message key, resolved by the screen via `t(...)`. */
  messageKey: string;
};

export type TagState = {
  status: TagStatus;

  /** Category as the user typed it (UI), preserving case and whitespace.
   * Server lowercases on save (ADR-0008 §2). */
  categoryInput: string;
  /** Notes as the user typed them. */
  notesInput: string;

  /** The last server-confirmed business_category (lowercased per ADR-0008
   * §2). Used to render the tagged-summary row (DES-0005 §3.3). */
  savedCategory: string | null;
  /** The last server-confirmed notes. */
  savedNotes: string | null;

  /** The state we entered `editing` from — needed so Cancel can revert
   * correctly (a fresh tag attempt needs to revert the toggle). */
  enteredEditingFrom: "untagged_idle" | "tagged_idle" | null;

  /** Field-level validation errors (post-trim, post-length-cap). */
  validationError: TagValidationError | null;
};

export type TagAction =
  | { type: "INIT"; tagged: boolean; category: string | null; notes: string | null }
  | { type: "TOGGLE_TAPPED" }
  | { type: "ROW_TAPPED" }
  | { type: "CATEGORY_TYPED"; value: string }
  | { type: "NOTES_TYPED"; value: string }
  | { type: "SAVE_TAPPED" }
  | { type: "CANCEL_TAPPED" }
  | { type: "TAG_SAVED"; category: string | null; notes: string | null }
  | { type: "UNTAG_SAVED" }
  | { type: "NETWORK_ERROR" }
  | { type: "VALIDATION_ERROR"; error: TagValidationError }
  | { type: "AUTH_ERROR" };

export const CATEGORY_MAX_LEN = 64;
export const NOTES_MAX_LEN = 500;

export function initialTagState(args: {
  tagged: boolean;
  category: string | null;
  notes: string | null;
}): TagState {
  return {
    status: args.tagged ? "tagged_idle" : "untagged_idle",
    categoryInput: args.category ?? "",
    notesInput: args.notes ?? "",
    savedCategory: args.category,
    savedNotes: args.notes,
    enteredEditingFrom: null,
    validationError: null,
  };
}

export function tagReducer(state: TagState, action: TagAction): TagState {
  switch (action.type) {
    case "INIT":
      return initialTagState({
        tagged: action.tagged,
        category: action.category,
        notes: action.notes,
      });

    case "TOGGLE_TAPPED":
      // From untagged → editing (no POST yet — the user might cancel).
      if (state.status === "untagged_idle") {
        return {
          ...state,
          status: "editing",
          enteredEditingFrom: "untagged_idle",
          // Pre-fill from saved (which is null/null in this branch).
          categoryInput: state.savedCategory ?? "",
          notesInput: state.savedNotes ?? "",
          validationError: null,
        };
      }
      // From tagged → untagging (optimistic flip; POST fires immediately).
      if (state.status === "tagged_idle") {
        return {
          ...state,
          status: "untagging",
          validationError: null,
        };
      }
      return state;

    case "ROW_TAPPED":
      // Tapping the tagged-summary row opens the editor pre-filled.
      if (state.status === "tagged_idle") {
        return {
          ...state,
          status: "editing",
          enteredEditingFrom: "tagged_idle",
          categoryInput: state.savedCategory ?? "",
          notesInput: state.savedNotes ?? "",
          validationError: null,
        };
      }
      return state;

    case "CATEGORY_TYPED":
      // Caps the input length pre-emptively at the post-trim cap so the
      // user can't type more than the server will accept. Whitespace is
      // preserved as-typed; trim happens at SAVE_TAPPED.
      return {
        ...state,
        categoryInput: action.value.slice(0, CATEGORY_MAX_LEN * 2),
        validationError: null,
      };

    case "NOTES_TYPED":
      return {
        ...state,
        notesInput: action.value.slice(0, NOTES_MAX_LEN * 2),
        validationError: null,
      };

    case "SAVE_TAPPED": {
      if (state.status !== "editing") return state;
      const trimmedCategory = state.categoryInput.trim();
      const trimmedNotes = state.notesInput.trim();
      if (trimmedCategory.length === 0) {
        return {
          ...state,
          validationError: {
            field: "category",
            messageKey: "tag.category.required",
          },
        };
      }
      if (trimmedCategory.length > CATEGORY_MAX_LEN) {
        return {
          ...state,
          validationError: {
            field: "category",
            messageKey: "tag.category.too_long",
          },
        };
      }
      if (trimmedNotes.length > NOTES_MAX_LEN) {
        return {
          ...state,
          validationError: {
            field: "notes",
            messageKey: "tag.notes.too_long",
          },
        };
      }
      return {
        ...state,
        status: "saving",
        validationError: null,
      };
    }

    case "CANCEL_TAPPED":
      if (state.status !== "editing") return state;
      return {
        ...state,
        status:
          state.enteredEditingFrom === "tagged_idle"
            ? "tagged_idle"
            : "untagged_idle",
        enteredEditingFrom: null,
        // Restore the saved values so a cancel after typing is a true revert.
        categoryInput: state.savedCategory ?? "",
        notesInput: state.savedNotes ?? "",
        validationError: null,
      };

    case "TAG_SAVED":
      return {
        ...state,
        status: "tagged_idle",
        savedCategory: action.category,
        savedNotes: action.notes,
        categoryInput: action.category ?? "",
        notesInput: action.notes ?? "",
        enteredEditingFrom: null,
        validationError: null,
      };

    case "UNTAG_SAVED":
      return {
        ...state,
        status: "untagged_idle",
        savedCategory: null,
        savedNotes: null,
        categoryInput: "",
        notesInput: "",
        enteredEditingFrom: null,
        validationError: null,
      };

    case "NETWORK_ERROR":
      // From `saving` → back to `editing` so the user keeps their input.
      // From `untagging` → back to `tagged_idle` (revert the toggle flip).
      if (state.status === "saving") {
        return { ...state, status: "editing" };
      }
      if (state.status === "untagging") {
        return { ...state, status: "tagged_idle" };
      }
      return state;

    case "VALIDATION_ERROR":
      // Server returned 422 — surface the field-level error and stay
      // editing so the user can fix it.
      if (state.status === "saving") {
        return { ...state, status: "editing", validationError: action.error };
      }
      return state;

    case "AUTH_ERROR":
      return { ...state, status: "auth_error", validationError: null };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Telemetry helper (DES-0005 §6)
// ---------------------------------------------------------------------------

export type TagTelemetryEvent =
  | { name: "tag.panel.opened"; from: "untagged" | "tagged" }
  | { name: "tag.applied" }
  | { name: "tag.removed" }
  | { name: "tag.failed.network" }
  | { name: "tag.failed.auth" }
  | { name: "tag.failed.validation"; field: "category" | "notes" }
  | { name: "tag.cancelled" };

/** Pure helper for telemetry: returns the event to emit on a status
 * transition (or `null` if the transition is silent). The category text
 * and notes text are NEVER attached. */
export function tagTelemetryEventFor(
  prev: TagState,
  next: TagState
): TagTelemetryEvent | null {
  if (prev.status === next.status) {
    // Validation error on Save tap — same status (`editing`) but error set.
    if (
      prev.status === "editing" &&
      prev.validationError === null &&
      next.validationError !== null
    ) {
      return {
        name: "tag.failed.validation",
        field: next.validationError.field,
      };
    }
    return null;
  }

  if (
    prev.status === "untagged_idle" &&
    next.status === "editing" &&
    next.enteredEditingFrom === "untagged_idle"
  ) {
    return { name: "tag.panel.opened", from: "untagged" };
  }
  if (
    prev.status === "tagged_idle" &&
    next.status === "editing" &&
    next.enteredEditingFrom === "tagged_idle"
  ) {
    return { name: "tag.panel.opened", from: "tagged" };
  }
  if (prev.status === "saving" && next.status === "tagged_idle") {
    return { name: "tag.applied" };
  }
  if (prev.status === "untagging" && next.status === "untagged_idle") {
    return { name: "tag.removed" };
  }
  if (
    (prev.status === "saving" || prev.status === "untagging") &&
    next.status === "auth_error"
  ) {
    return { name: "tag.failed.auth" };
  }
  if (
    prev.status === "saving" &&
    next.status === "editing" &&
    next.validationError === null
  ) {
    return { name: "tag.failed.network" };
  }
  if (prev.status === "untagging" && next.status === "tagged_idle") {
    return { name: "tag.failed.network" };
  }
  if (prev.status === "editing" && next.status !== "saving") {
    if (
      next.status === "untagged_idle" ||
      next.status === "tagged_idle"
    ) {
      return { name: "tag.cancelled" };
    }
  }
  return null;
}
