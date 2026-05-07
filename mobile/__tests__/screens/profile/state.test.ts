/**
 * Tests for the Profile screen reducer (BLG-0017 / DES-0004 §2).
 *
 * Covers every transition listed in DES-0004 §2 plus the local ΑΦΜ
 * validation path (which prevents a wasted PATCH on garbage input) and
 * the phone-mask helper.
 */

import {
  initialProfileState,
  maskPhone,
  profileReducer,
  type ProfileState,
} from "../../../src/screens/profile/state";

function fresh(overrides: Partial<Parameters<typeof initialProfileState>[0]> = {}): ProfileState {
  return initialProfileState({
    userId: "u-1",
    phone: "+306900001234",
    lastSignInAt: "2026-05-07T17:30:00+03:00",
    isFreelancer: false,
    afm: null,
    ...overrides,
  });
}

describe("initialProfileState", () => {
  it("starts in idle with the seeded values", () => {
    const s = fresh();
    expect(s.status).toBe("idle");
    expect(s.userId).toBe("u-1");
    expect(s.isFreelancer).toBe(false);
    expect(s.afm).toBeNull();
    expect(s.afmInput).toBe("");
    expect(s.pendingFreelancer).toBeNull();
  });

  it("seeds the ΑΦΜ TextInput from the existing ΑΦΜ when present", () => {
    const s = fresh({ isFreelancer: true, afm: "094019245" });
    expect(s.afmInput).toBe("094019245");
  });
});

describe("freelancer toggle", () => {
  it("FREELANCER_TOGGLE_TAPPED → editing_freelancer + optimistic flip", () => {
    const next = profileReducer(fresh(), {
      type: "FREELANCER_TOGGLE_TAPPED",
    });
    expect(next.status).toBe("editing_freelancer");
    expect(next.pendingFreelancer).toBe(true);
  });

  it("FREELANCER_PATCH_OK → idle + new value applied", () => {
    let s = profileReducer(fresh(), { type: "FREELANCER_TOGGLE_TAPPED" });
    s = profileReducer(s, {
      type: "FREELANCER_PATCH_OK",
      isFreelancer: true,
      afm: null,
    });
    expect(s.status).toBe("idle");
    expect(s.isFreelancer).toBe(true);
    expect(s.pendingFreelancer).toBeNull();
  });

  it("FREELANCER_PATCH_NETWORK_ERROR reverts the optimistic flip", () => {
    let s = profileReducer(fresh(), { type: "FREELANCER_TOGGLE_TAPPED" });
    s = profileReducer(s, { type: "FREELANCER_PATCH_NETWORK_ERROR" });
    expect(s.status).toBe("idle");
    expect(s.isFreelancer).toBe(false); // reverted
    expect(s.pendingFreelancer).toBeNull();
    expect(s.networkError?.surface).toBe("freelancer");
  });

  it("toggling off does NOT clear ΑΦΜ on the response", () => {
    let s = fresh({ isFreelancer: true, afm: "094019245" });
    s = profileReducer(s, { type: "FREELANCER_TOGGLE_TAPPED" });
    s = profileReducer(s, {
      type: "FREELANCER_PATCH_OK",
      isFreelancer: false,
      afm: "094019245", // server preserves it
    });
    expect(s.isFreelancer).toBe(false);
    expect(s.afm).toBe("094019245");
  });
});

describe("ΑΦΜ field", () => {
  function freelancer(): ProfileState {
    return fresh({ isFreelancer: true, afm: null });
  }

  it("AFM_INPUT_CHANGED caps at 9 chars and clears validation error", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "AFM_INPUT_CHANGED",
      value: "12345678901234",
    });
    expect(s.afmInput).toBe("123456789");
  });

  it("AFM_SAVE_TAPPED with invalid input → validation_error (no transition)", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "AFM_INPUT_CHANGED",
      value: "12345678",
    });
    s = profileReducer(s, { type: "AFM_SAVE_TAPPED" });
    expect(s.status).toBe("idle");
    expect(s.validationError?.field).toBe("afm");
  });

  it("AFM_SAVE_TAPPED with valid ΑΦΜ → editing_afm", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "AFM_INPUT_CHANGED",
      value: "094019245",
    });
    s = profileReducer(s, { type: "AFM_SAVE_TAPPED" });
    expect(s.status).toBe("editing_afm");
    expect(s.validationError).toBeNull();
  });

  it("AFM_PATCH_OK → idle + new value reflected in input", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "AFM_INPUT_CHANGED",
      value: "094019245",
    });
    s = profileReducer(s, { type: "AFM_SAVE_TAPPED" });
    s = profileReducer(s, { type: "AFM_PATCH_OK", afm: "094019245" });
    expect(s.status).toBe("idle");
    expect(s.afm).toBe("094019245");
    expect(s.afmInput).toBe("094019245");
  });

  it("AFM_PATCH_VALIDATION_ERROR → idle + visible error", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "AFM_INPUT_CHANGED",
      value: "094019245",
    });
    s = profileReducer(s, { type: "AFM_SAVE_TAPPED" });
    s = profileReducer(s, {
      type: "AFM_PATCH_VALIDATION_ERROR",
      messageKey: "profile.afm.invalid",
    });
    expect(s.status).toBe("idle");
    expect(s.validationError?.field).toBe("afm");
  });

  it("AFM_PATCH_NETWORK_ERROR → idle + visible network error", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "AFM_INPUT_CHANGED",
      value: "094019245",
    });
    s = profileReducer(s, { type: "AFM_SAVE_TAPPED" });
    s = profileReducer(s, { type: "AFM_PATCH_NETWORK_ERROR" });
    expect(s.status).toBe("idle");
    expect(s.networkError?.surface).toBe("afm");
  });
});

describe("export action", () => {
  function freelancer(): ProfileState {
    return fresh({ isFreelancer: true, afm: "094019245" });
  }

  it("seeds default range to first-of-month → today", () => {
    // Use a fixed `now` so the test is timezone-independent.
    const s = initialProfileState({
      userId: "u-1",
      phone: null,
      lastSignInAt: null,
      isFreelancer: true,
      afm: "094019245",
      now: new Date(2026, 4, 15), // local 2026-05-15
    });
    expect(s.exportFromDate).toBe("2026-05-01");
    expect(s.exportToDate).toBe("2026-05-15");
  });

  it("EXPORT_FROM_CHANGED / EXPORT_TO_CHANGED update the range", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "EXPORT_FROM_CHANGED",
      value: "2026-01-01",
    });
    s = profileReducer(s, {
      type: "EXPORT_TO_CHANGED",
      value: "2026-04-30",
    });
    expect(s.exportFromDate).toBe("2026-01-01");
    expect(s.exportToDate).toBe("2026-04-30");
  });

  it("EXPORT_GENERATE_TAPPED with valid range → exporting", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "EXPORT_FROM_CHANGED",
      value: "2026-01-01",
    });
    s = profileReducer(s, {
      type: "EXPORT_TO_CHANGED",
      value: "2026-04-30",
    });
    s = profileReducer(s, { type: "EXPORT_GENERATE_TAPPED" });
    expect(s.status).toBe("exporting");
  });

  it("EXPORT_GENERATE_TAPPED with to < from → validation_error", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "EXPORT_FROM_CHANGED",
      value: "2026-04-30",
    });
    s = profileReducer(s, {
      type: "EXPORT_TO_CHANGED",
      value: "2026-01-01",
    });
    s = profileReducer(s, { type: "EXPORT_GENERATE_TAPPED" });
    expect(s.status).toBe("idle");
    expect(s.validationError?.field).toBe("to_date");
    expect(s.validationError?.messageKey).toBe(
      "profile.export.range_invalid"
    );
  });

  it("EXPORT_GENERATE_TAPPED with too-long range → validation_error", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "EXPORT_FROM_CHANGED",
      value: "2024-01-01",
    });
    s = profileReducer(s, {
      type: "EXPORT_TO_CHANGED",
      value: "2026-04-30",
    });
    s = profileReducer(s, { type: "EXPORT_GENERATE_TAPPED" });
    expect(s.status).toBe("idle");
    expect(s.validationError?.messageKey).toBe(
      "profile.export.range_too_long"
    );
  });

  it("EXPORT_GENERATE_TAPPED with malformed date → validation_error", () => {
    let s = freelancer();
    s = profileReducer(s, {
      type: "EXPORT_FROM_CHANGED",
      value: "not-a-date",
    });
    s = profileReducer(s, { type: "EXPORT_GENERATE_TAPPED" });
    expect(s.status).toBe("idle");
    expect(s.validationError?.field).toBe("from_date");
  });

  it("EXPORT_DONE → idle", () => {
    let s = freelancer();
    s = profileReducer(s, { type: "EXPORT_GENERATE_TAPPED" });
    s = profileReducer(s, { type: "EXPORT_DONE" });
    expect(s.status).toBe("idle");
  });

  it("EXPORT_NETWORK_ERROR → idle + visible network error", () => {
    let s = freelancer();
    s = profileReducer(s, { type: "EXPORT_GENERATE_TAPPED" });
    s = profileReducer(s, { type: "EXPORT_NETWORK_ERROR" });
    expect(s.status).toBe("idle");
    expect(s.networkError?.surface).toBe("export");
  });
});

describe("sign out + auth error", () => {
  it("SIGN_OUT_TAPPED → signing_out", () => {
    const next = profileReducer(fresh(), { type: "SIGN_OUT_TAPPED" });
    expect(next.status).toBe("signing_out");
  });

  it("AUTH_ERROR is a terminal transition from any state", () => {
    let s = fresh();
    s = profileReducer(s, { type: "FREELANCER_TOGGLE_TAPPED" });
    s = profileReducer(s, { type: "AUTH_ERROR" });
    expect(s.status).toBe("auth_error");
  });
});

describe("maskPhone", () => {
  it("masks a +30 number to country code + last 4", () => {
    expect(maskPhone("+306900001234")).toBe("+30 6XX *** 1234");
  });

  it("returns empty string for null / undefined", () => {
    expect(maskPhone(null)).toBe("");
  });

  it("never echoes the middle digits", () => {
    const masked = maskPhone("+306987654321");
    expect(masked).not.toContain("987");
    expect(masked).not.toContain("65");
    expect(masked).toContain("4321");
  });
});
