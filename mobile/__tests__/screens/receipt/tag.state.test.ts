/**
 * Tests for the tag-as-business reducer (BLG-0018 / DES-0005 §2).
 *
 * Every transition listed in DES-0005 §2 is asserted, plus the validation
 * errors and the telemetry events from §6. Pure-TS, no RN imports.
 */

import {
  CATEGORY_MAX_LEN,
  NOTES_MAX_LEN,
  initialTagState,
  tagReducer,
  tagTelemetryEventFor,
  type TagState,
} from "../../../src/screens/receipt/tag.state";

describe("tag.state — initialTagState", () => {
  it("starts in untagged_idle when not tagged", () => {
    const s = initialTagState({ tagged: false, category: null, notes: null });
    expect(s.status).toBe("untagged_idle");
    expect(s.savedCategory).toBeNull();
    expect(s.savedNotes).toBeNull();
    expect(s.categoryInput).toBe("");
    expect(s.notesInput).toBe("");
  });

  it("starts in tagged_idle with the saved category and notes pre-filled", () => {
    const s = initialTagState({
      tagged: true,
      category: "groceries",
      notes: "client lunch",
    });
    expect(s.status).toBe("tagged_idle");
    expect(s.savedCategory).toBe("groceries");
    expect(s.savedNotes).toBe("client lunch");
    expect(s.categoryInput).toBe("groceries");
    expect(s.notesInput).toBe("client lunch");
  });
});

describe("tag.state — transitions", () => {
  function fresh(): TagState {
    return initialTagState({ tagged: false, category: null, notes: null });
  }

  function tagged(): TagState {
    return initialTagState({
      tagged: true,
      category: "groceries",
      notes: "client lunch",
    });
  }

  it("untagged_idle + TOGGLE_TAPPED → editing", () => {
    const next = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    expect(next.status).toBe("editing");
    expect(next.enteredEditingFrom).toBe("untagged_idle");
  });

  it("tagged_idle + TOGGLE_TAPPED → untagging (optimistic flip)", () => {
    const next = tagReducer(tagged(), { type: "TOGGLE_TAPPED" });
    expect(next.status).toBe("untagging");
  });

  it("tagged_idle + ROW_TAPPED → editing with pre-fill", () => {
    const next = tagReducer(tagged(), { type: "ROW_TAPPED" });
    expect(next.status).toBe("editing");
    expect(next.enteredEditingFrom).toBe("tagged_idle");
    expect(next.categoryInput).toBe("groceries");
    expect(next.notesInput).toBe("client lunch");
  });

  it("CATEGORY_TYPED updates input and clears validation error", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    expect(s.validationError).not.toBeNull();
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "fuel" });
    expect(s.categoryInput).toBe("fuel");
    expect(s.validationError).toBeNull();
  });

  it("SAVE_TAPPED with blank category → validation_error (no transition)", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "   " });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    expect(s.status).toBe("editing");
    expect(s.validationError).toEqual({
      field: "category",
      messageKey: "tag.category.required",
    });
  });

  it("SAVE_TAPPED with too-long category (post-trim) → validation_error", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, {
      type: "CATEGORY_TYPED",
      value: "a".repeat(CATEGORY_MAX_LEN + 1),
    });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    expect(s.validationError).toEqual({
      field: "category",
      messageKey: "tag.category.too_long",
    });
  });

  it("SAVE_TAPPED with too-long notes → validation_error on notes field", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "groceries" });
    s = tagReducer(s, {
      type: "NOTES_TYPED",
      value: "x".repeat(NOTES_MAX_LEN + 1),
    });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    expect(s.validationError?.field).toBe("notes");
  });

  it("SAVE_TAPPED with valid input → saving", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "groceries" });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    expect(s.status).toBe("saving");
  });

  it("saving + TAG_SAVED → tagged_idle with new saved values", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "  Groceries  " });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    s = tagReducer(s, {
      type: "TAG_SAVED",
      category: "groceries",
      notes: null,
    });
    expect(s.status).toBe("tagged_idle");
    expect(s.savedCategory).toBe("groceries");
    expect(s.savedNotes).toBeNull();
  });

  it("untagging + UNTAG_SAVED → untagged_idle with cleared state", () => {
    let s = tagReducer(tagged(), { type: "TOGGLE_TAPPED" });
    expect(s.status).toBe("untagging");
    s = tagReducer(s, { type: "UNTAG_SAVED" });
    expect(s.status).toBe("untagged_idle");
    expect(s.savedCategory).toBeNull();
    expect(s.savedNotes).toBeNull();
  });

  it("saving + NETWORK_ERROR → editing (preserves user input)", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "fuel" });
    s = tagReducer(s, { type: "NOTES_TYPED", value: "trip" });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    s = tagReducer(s, { type: "NETWORK_ERROR" });
    expect(s.status).toBe("editing");
    expect(s.categoryInput).toBe("fuel");
    expect(s.notesInput).toBe("trip");
  });

  it("untagging + NETWORK_ERROR → tagged_idle (revert toggle)", () => {
    let s = tagReducer(tagged(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "NETWORK_ERROR" });
    expect(s.status).toBe("tagged_idle");
    expect(s.savedCategory).toBe("groceries");
  });

  it("editing (from fresh) + CANCEL_TAPPED → untagged_idle", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "fuel" });
    s = tagReducer(s, { type: "CANCEL_TAPPED" });
    expect(s.status).toBe("untagged_idle");
    expect(s.categoryInput).toBe("");
  });

  it("editing (from tagged) + CANCEL_TAPPED → tagged_idle (preserves saved)", () => {
    let s = tagReducer(tagged(), { type: "ROW_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "abandoned-edit" });
    s = tagReducer(s, { type: "CANCEL_TAPPED" });
    expect(s.status).toBe("tagged_idle");
    expect(s.categoryInput).toBe("groceries"); // restored from saved
    expect(s.savedCategory).toBe("groceries");
  });

  it("AUTH_ERROR is a terminal transition from any state", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "AUTH_ERROR" });
    expect(s.status).toBe("auth_error");
  });

  it("VALIDATION_ERROR from server (during saving) → editing + error", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "groceries" });
    s = tagReducer(s, { type: "SAVE_TAPPED" });
    s = tagReducer(s, {
      type: "VALIDATION_ERROR",
      error: { field: "category", messageKey: "tag.category.too_long" },
    });
    expect(s.status).toBe("editing");
    expect(s.validationError?.field).toBe("category");
  });

  it("INIT replaces the entire state to initialTagState", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "stale" });
    s = tagReducer(s, {
      type: "INIT",
      tagged: true,
      category: "transport",
      notes: null,
    });
    expect(s.status).toBe("tagged_idle");
    expect(s.savedCategory).toBe("transport");
    expect(s.categoryInput).toBe("transport");
  });
});

describe("tag.state — telemetry events", () => {
  function fresh(): TagState {
    return initialTagState({ tagged: false, category: null, notes: null });
  }

  function tagged(): TagState {
    return initialTagState({
      tagged: true,
      category: "groceries",
      notes: null,
    });
  }

  it("emits tag.panel.opened with from='untagged' on first toggle", () => {
    const before = fresh();
    const after = tagReducer(before, { type: "TOGGLE_TAPPED" });
    expect(tagTelemetryEventFor(before, after)).toEqual({
      name: "tag.panel.opened",
      from: "untagged",
    });
  });

  it("emits tag.panel.opened with from='tagged' on row tap", () => {
    const before = tagged();
    const after = tagReducer(before, { type: "ROW_TAPPED" });
    expect(tagTelemetryEventFor(before, after)).toEqual({
      name: "tag.panel.opened",
      from: "tagged",
    });
  });

  it("emits tag.applied when saving completes", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "groceries" });
    const saving = tagReducer(s, { type: "SAVE_TAPPED" });
    const tagged = tagReducer(saving, {
      type: "TAG_SAVED",
      category: "groceries",
      notes: null,
    });
    expect(tagTelemetryEventFor(saving, tagged)).toEqual({
      name: "tag.applied",
    });
  });

  it("emits tag.removed when untagging completes", () => {
    const before = tagReducer(tagged(), { type: "TOGGLE_TAPPED" });
    const after = tagReducer(before, { type: "UNTAG_SAVED" });
    expect(tagTelemetryEventFor(before, after)).toEqual({
      name: "tag.removed",
    });
  });

  it("emits tag.failed.network on saving → editing", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "groceries" });
    const saving = tagReducer(s, { type: "SAVE_TAPPED" });
    const back = tagReducer(saving, { type: "NETWORK_ERROR" });
    expect(tagTelemetryEventFor(saving, back)).toEqual({
      name: "tag.failed.network",
    });
  });

  it("emits tag.failed.auth on saving → auth_error", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "groceries" });
    const saving = tagReducer(s, { type: "SAVE_TAPPED" });
    const after = tagReducer(saving, { type: "AUTH_ERROR" });
    expect(tagTelemetryEventFor(saving, after)).toEqual({
      name: "tag.failed.auth",
    });
  });

  it("emits tag.failed.validation when SAVE_TAPPED triggers a local validation error", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    s = tagReducer(s, { type: "CATEGORY_TYPED", value: "  " });
    const after = tagReducer(s, { type: "SAVE_TAPPED" });
    expect(tagTelemetryEventFor(s, after)).toEqual({
      name: "tag.failed.validation",
      field: "category",
    });
  });

  it("emits tag.cancelled on editing → idle", () => {
    let s = tagReducer(fresh(), { type: "TOGGLE_TAPPED" });
    const editing = tagReducer(s, { type: "CATEGORY_TYPED", value: "g" });
    const cancelled = tagReducer(editing, { type: "CANCEL_TAPPED" });
    expect(tagTelemetryEventFor(editing, cancelled)).toEqual({
      name: "tag.cancelled",
    });
  });
});
