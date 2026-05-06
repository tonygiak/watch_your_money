import {
  initialLoginState,
  loginReducer,
  loginTelemetryEventFor,
  type LoginAction,
  type LoginState,
} from "../../../src/screens/login/state";

const E164 = "+306912345678";

function step(state: LoginState, action: LoginAction): LoginState {
  return loginReducer(state, action);
}

describe("loginReducer — DES-0002 transitions", () => {
  it("starts in idle with empty fields", () => {
    expect(initialLoginState.status).toBe("idle");
    expect(initialLoginState.phoneInput).toBe("");
    expect(initialLoginState.otpInput).toBe("");
    expect(initialLoginState.phoneE164).toBeNull();
  });

  it("idle → entering_phone on PHONE_TYPED", () => {
    const next = step(initialLoginState, { type: "PHONE_TYPED", value: "6" });
    expect(next.status).toBe("entering_phone");
    expect(next.phoneInput).toBe("6");
  });

  it("entering_phone → submitting_phone on SUBMIT_PHONE", () => {
    let s = step(initialLoginState, { type: "PHONE_TYPED", value: "6912345678" });
    s = step(s, { type: "SUBMIT_PHONE", e164: E164 });
    expect(s.status).toBe("submitting_phone");
    expect(s.phoneE164).toBe(E164);
  });

  it("submitting_phone → awaiting_otp on OTP_SENT", () => {
    let s = step(initialLoginState, { type: "PHONE_TYPED", value: "6912345678" });
    s = step(s, { type: "SUBMIT_PHONE", e164: E164 });
    s = step(s, { type: "OTP_SENT" });
    expect(s.status).toBe("awaiting_otp");
    expect(s.otpInput).toBe("");
  });

  it("submitting_phone → network_error on NETWORK_ERROR", () => {
    let s = step(initialLoginState, { type: "PHONE_TYPED", value: "6912345678" });
    s = step(s, { type: "SUBMIT_PHONE", e164: E164 });
    s = step(s, { type: "NETWORK_ERROR" });
    expect(s.status).toBe("network_error");
    expect(s.errorCode).toBe("network");
  });

  it("submitting_phone → rate_limited on RATE_LIMITED", () => {
    let s = step(initialLoginState, { type: "PHONE_TYPED", value: "6912345678" });
    s = step(s, { type: "SUBMIT_PHONE", e164: E164 });
    s = step(s, { type: "RATE_LIMITED", cooldownSeconds: 30 });
    expect(s.status).toBe("rate_limited");
    expect(s.cooldownSeconds).toBe(30);
  });

  it("network_error retains the last typed phone (DES-0002 §2)", () => {
    let s = step(initialLoginState, { type: "PHONE_TYPED", value: "6912345678" });
    s = step(s, { type: "SUBMIT_PHONE", e164: E164 });
    s = step(s, { type: "NETWORK_ERROR" });
    expect(s.phoneInput).toBe("6912345678");
    s = step(s, { type: "PHONE_TYPED", value: "6912345679" });
    expect(s.status).toBe("entering_phone");
    expect(s.phoneInput).toBe("6912345679");
  });

  it("submitting_phone → entering_phone with invalid_phone on PHONE_INVALID", () => {
    let s = step(initialLoginState, { type: "PHONE_TYPED", value: "abc" });
    s = step(s, { type: "SUBMIT_PHONE", e164: "+30abc" });
    s = step(s, { type: "PHONE_INVALID" });
    expect(s.status).toBe("entering_phone");
    expect(s.errorCode).toBe("invalid_phone");
  });

  it("OTP typing accumulates, SUBMIT_OTP enforces the 6-digit precondition", () => {
    let s = primeAwaitingOtp();
    s = step(s, { type: "OTP_TYPED", value: "12345" });
    s = step(s, { type: "SUBMIT_OTP" });
    expect(s.status).toBe("awaiting_otp"); // not enough digits — no transition

    s = step(s, { type: "OTP_TYPED", value: "123456" });
    s = step(s, { type: "SUBMIT_OTP" });
    expect(s.status).toBe("verifying_otp");
  });

  it("verifying_otp → success on OTP_VERIFIED", () => {
    let s = primeVerifyingOtp();
    s = step(s, { type: "OTP_VERIFIED" });
    expect(s.status).toBe("success");
  });

  it("verifying_otp → wrong_otp on OTP_WRONG (clears otp input)", () => {
    let s = primeVerifyingOtp();
    s = step(s, { type: "OTP_WRONG" });
    expect(s.status).toBe("wrong_otp");
    expect(s.errorCode).toBe("wrong_otp");
    expect(s.otpInput).toBe("");
  });

  it("wrong_otp + OTP_TYPED clears the error and returns to awaiting_otp", () => {
    let s = primeVerifyingOtp();
    s = step(s, { type: "OTP_WRONG" });
    s = step(s, { type: "OTP_TYPED", value: "1" });
    expect(s.status).toBe("awaiting_otp");
    expect(s.errorCode).toBeNull();
  });

  it("verifying_otp → expired_otp on OTP_EXPIRED", () => {
    let s = primeVerifyingOtp();
    s = step(s, { type: "OTP_EXPIRED" });
    expect(s.status).toBe("expired_otp");
    expect(s.otpInput).toBe("");
  });

  it("RESEND moves to cooldown with the configured seconds", () => {
    let s = primeAwaitingOtp();
    s = step(s, { type: "RESEND_REQUESTED", cooldownSeconds: 30 });
    expect(s.status).toBe("cooldown");
    expect(s.cooldownSeconds).toBe(30);
  });

  it("cooldown ticks down and ends back into awaiting_otp", () => {
    let s = primeAwaitingOtp();
    s = step(s, { type: "RESEND_REQUESTED", cooldownSeconds: 30 });
    s = step(s, { type: "COOLDOWN_TICK", remaining: 10 });
    expect(s.cooldownSeconds).toBe(10);
    s = step(s, { type: "COOLDOWN_ENDED" });
    expect(s.status).toBe("awaiting_otp");
    expect(s.cooldownSeconds).toBe(0);
  });

  it("BACK_TO_PHONE re-opens entering_phone from awaiting_otp", () => {
    let s = primeAwaitingOtp();
    s = step(s, { type: "BACK_TO_PHONE" });
    expect(s.status).toBe("entering_phone");
    expect(s.otpInput).toBe("");
    expect(s.phoneE164).toBeNull();
  });

  it("BACK_TO_PHONE is a no-op while a request is in flight", () => {
    let s = step(initialLoginState, { type: "PHONE_TYPED", value: "6912345678" });
    s = step(s, { type: "SUBMIT_PHONE", e164: E164 });
    const prev = s;
    s = step(s, { type: "BACK_TO_PHONE" });
    expect(s).toBe(prev);
  });

  it("RESET collapses to initial state from any status", () => {
    let s = primeVerifyingOtp();
    s = step(s, { type: "RESET" });
    expect(s).toEqual(initialLoginState);
  });
});

describe("loginTelemetryEventFor", () => {
  it("emits the documented submit and verify events", () => {
    expect(
      loginTelemetryEventFor("entering_phone", "submitting_phone")
    ).toBe("login.submit_phone.attempted");
    expect(
      loginTelemetryEventFor("submitting_phone", "awaiting_otp")
    ).toBe("login.submit_phone.succeeded");
    expect(
      loginTelemetryEventFor("submitting_phone", "network_error")
    ).toBe("login.submit_phone.failed.network");
    expect(
      loginTelemetryEventFor("submitting_phone", "rate_limited")
    ).toBe("login.submit_phone.failed.rate_limited");
    expect(
      loginTelemetryEventFor("verifying_otp", "success")
    ).toBe("login.verify_otp.succeeded");
    expect(
      loginTelemetryEventFor("verifying_otp", "wrong_otp")
    ).toBe("login.verify_otp.failed.wrong");
    expect(
      loginTelemetryEventFor("verifying_otp", "expired_otp")
    ).toBe("login.verify_otp.failed.expired");
    expect(
      loginTelemetryEventFor("verifying_otp", "network_error")
    ).toBe("login.verify_otp.failed.network");
    expect(
      loginTelemetryEventFor("awaiting_otp", "cooldown")
    ).toBe("login.cooldown.entered");
  });

  it("returns null for non-noteworthy transitions", () => {
    expect(loginTelemetryEventFor("idle", "entering_phone")).toBeNull();
    expect(loginTelemetryEventFor("entering_phone", "entering_phone")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Helpers — keep test cases readable
// ---------------------------------------------------------------------------

function primeAwaitingOtp(): LoginState {
  let s = loginReducer(initialLoginState, { type: "PHONE_TYPED", value: "6912345678" });
  s = loginReducer(s, { type: "SUBMIT_PHONE", e164: E164 });
  s = loginReducer(s, { type: "OTP_SENT" });
  return s;
}

function primeVerifyingOtp(): LoginState {
  let s = primeAwaitingOtp();
  s = loginReducer(s, { type: "OTP_TYPED", value: "123456" });
  s = loginReducer(s, { type: "SUBMIT_OTP" });
  return s;
}
