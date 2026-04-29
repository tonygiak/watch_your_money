import {
  initialScannerState,
  type ScannerState,
  scannerReducer,
  telemetryEventFor,
} from "../../../src/screens/scanner/state";

const QR =
  "https://e-invoicing.gr/edocuments/ViewInvoice/-1/11111111-2222-3333-4444-555555555555_TOKENABC";

function step(state: ScannerState, action: Parameters<typeof scannerReducer>[1]) {
  return scannerReducer(state, action);
}

describe("scannerReducer — DES-0001 transitions", () => {
  it("starts in idle", () => {
    expect(initialScannerState.status).toBe("idle");
    expect(initialScannerState.qrUrl).toBeNull();
    expect(initialScannerState.receipt).toBeNull();
    expect(initialScannerState.errorCode).toBeNull();
  });

  it("idle → permission_check on FAB_PRESSED", () => {
    const next = step(initialScannerState, { type: "FAB_PRESSED" });
    expect(next.status).toBe("permission_check");
  });

  it("permission_check → scanning on PERMISSION_GRANTED", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    expect(s.status).toBe("scanning");
  });

  it("permission_check → permission_denied on PERMISSION_DENIED", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_DENIED" });
    expect(s.status).toBe("permission_denied");
  });

  it("permission_check → permission_blocked on PERMISSION_BLOCKED", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_BLOCKED" });
    expect(s.status).toBe("permission_blocked");
  });

  it("scanning → validating_url on QR_DETECTED, capturing the URL", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "QR_DETECTED", qrUrl: QR });
    expect(s.status).toBe("validating_url");
    expect(s.qrUrl).toBe(QR);
    expect(s.retries).toBe(0);
  });

  it("scanning → unsupported_qr on QR_UNSUPPORTED (camera-saw-bad-QR path)", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "QR_UNSUPPORTED" });
    expect(s.status).toBe("unsupported_qr");
    expect(s.errorCode).toBe("unsupported_url");
  });

  it("validating_url → unsupported_qr on QR_UNSUPPORTED (domain-check-fail path)", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "QR_DETECTED", qrUrl: QR });
    s = step(s, { type: "QR_UNSUPPORTED" });
    expect(s.status).toBe("unsupported_qr");
  });

  it("validating_url → submitting on QR_DOMAIN_OK", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "QR_DETECTED", qrUrl: QR });
    s = step(s, { type: "QR_DOMAIN_OK" });
    expect(s.status).toBe("submitting");
  });

  describe("submitting outcomes", () => {
    function getToSubmitting(): ScannerState {
      let s = step(initialScannerState, { type: "FAB_PRESSED" });
      s = step(s, { type: "PERMISSION_GRANTED" });
      s = step(s, { type: "QR_DETECTED", qrUrl: QR });
      s = step(s, { type: "QR_DOMAIN_OK" });
      return s;
    }

    it("→ success_new on SUBMIT_201_NEW with receipt id", () => {
      const s = step(getToSubmitting(), {
        type: "SUBMIT_201_NEW",
        receiptId: "abc",
      });
      expect(s.status).toBe("success_new");
      expect(s.receipt).toEqual({ receiptId: "abc", isDuplicate: false });
    });

    it("→ success_duplicate on SUBMIT_200_DUPLICATE with receipt id", () => {
      const s = step(getToSubmitting(), {
        type: "SUBMIT_200_DUPLICATE",
        receiptId: "abc",
      });
      expect(s.status).toBe("success_duplicate");
      expect(s.receipt).toEqual({ receiptId: "abc", isDuplicate: true });
    });

    it("→ auth_error on SUBMIT_401", () => {
      const s = step(getToSubmitting(), { type: "SUBMIT_401" });
      expect(s.status).toBe("auth_error");
      expect(s.errorCode).toBe("auth");
    });

    it("→ parse_error_user on SUBMIT_422", () => {
      const s = step(getToSubmitting(), { type: "SUBMIT_422" });
      expect(s.status).toBe("parse_error_user");
      expect(s.errorCode).toBe("parse_error");
    });

    it("→ network_error on SUBMIT_502", () => {
      const s = step(getToSubmitting(), { type: "SUBMIT_502" });
      expect(s.status).toBe("network_error");
      expect(s.errorCode).toBe("network");
    });

    it("→ network_error on SUBMIT_TIMEOUT", () => {
      const s = step(getToSubmitting(), { type: "SUBMIT_TIMEOUT" });
      expect(s.status).toBe("network_error");
    });

    it("→ parser_drift on SUBMIT_503", () => {
      const s = step(getToSubmitting(), { type: "SUBMIT_503" });
      expect(s.status).toBe("parser_drift");
      expect(s.errorCode).toBe("drift");
    });

    it("→ generic_error on SUBMIT_GENERIC_ERROR", () => {
      const s = step(getToSubmitting(), { type: "SUBMIT_GENERIC_ERROR" });
      expect(s.status).toBe("generic_error");
    });
  });

  it("RETRY re-enters submitting and bumps retries", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "QR_DETECTED", qrUrl: QR });
    s = step(s, { type: "QR_DOMAIN_OK" });
    s = step(s, { type: "SUBMIT_502" });
    expect(s.status).toBe("network_error");
    s = step(s, { type: "RETRY" });
    expect(s.status).toBe("submitting");
    expect(s.retries).toBe(1);
    expect(s.qrUrl).toBe(QR);
  });

  it("RETRY is a no-op when there is no qrUrl on hand", () => {
    const s = step(initialScannerState, { type: "RETRY" });
    expect(s).toBe(initialScannerState);
  });

  it("USER_CANCELLED resets to initial state from any state", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "QR_DETECTED", qrUrl: QR });
    s = step(s, { type: "USER_CANCELLED" });
    expect(s).toEqual(initialScannerState);
  });

  it("DISMISS_ERROR returns to scanning from unsupported_qr", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "QR_UNSUPPORTED" });
    s = step(s, { type: "DISMISS_ERROR" });
    expect(s.status).toBe("scanning");
  });

  it("CAMERA_ERROR transitions from scanning", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    s = step(s, { type: "CAMERA_ERROR" });
    expect(s.status).toBe("camera_error");
  });

  it("FAB_PRESSED is a no-op when not in idle (double-tap protection)", () => {
    let s = step(initialScannerState, { type: "FAB_PRESSED" });
    s = step(s, { type: "PERMISSION_GRANTED" });
    const before = s;
    s = step(s, { type: "FAB_PRESSED" });
    expect(s).toBe(before);
  });
});

describe("telemetryEventFor — counts only, no PII", () => {
  it("emits scanner_opened on idle → permission_check", () => {
    expect(telemetryEventFor("idle", "permission_check")).toBe("scanner_opened");
  });

  it("emits qr_detected_supported on scanning → validating_url", () => {
    expect(telemetryEventFor("scanning", "validating_url")).toBe(
      "qr_detected_supported"
    );
  });

  it("emits qr_detected_unsupported on either bad-QR path", () => {
    expect(telemetryEventFor("scanning", "unsupported_qr")).toBe(
      "qr_detected_unsupported"
    );
    expect(telemetryEventFor("validating_url", "unsupported_qr")).toBe(
      "qr_detected_unsupported"
    );
  });

  it("emits submit_success_new and submit_success_duplicate", () => {
    expect(telemetryEventFor("submitting", "success_new")).toBe(
      "submit_success_new"
    );
    expect(telemetryEventFor("submitting", "success_duplicate")).toBe(
      "submit_success_duplicate"
    );
  });

  it("emits one submit_failure_<code> per error path", () => {
    expect(telemetryEventFor("submitting", "auth_error")).toBe(
      "submit_failure_auth"
    );
    expect(telemetryEventFor("submitting", "parse_error_user")).toBe(
      "submit_failure_parse_error"
    );
    expect(telemetryEventFor("submitting", "network_error")).toBe(
      "submit_failure_network"
    );
    expect(telemetryEventFor("submitting", "parser_drift")).toBe(
      "submit_failure_drift"
    );
    expect(telemetryEventFor("submitting", "generic_error")).toBe(
      "submit_failure_generic"
    );
  });

  it("returns null for boring transitions", () => {
    expect(telemetryEventFor("idle", "idle")).toBeNull();
  });
});
