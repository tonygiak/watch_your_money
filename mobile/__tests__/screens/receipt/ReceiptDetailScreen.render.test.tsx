/**
 * Render-level smoke check for ReceiptDetailScreen (BLG-0018 / DES-0005).
 *
 * Goals:
 *   1. Greek-first header + line items + totals render from a CacheableReceipt.
 *   2. The inline tag panel (DES-0005 §3) renders the toggle in both
 *      untagged-collapsed and tagged-summary configurations.
 *   3. The toggle switches accessibility state on/off based on
 *      `is_business_expense`.
 *
 * The reducer logic + every transition lives in `tag.state.test.ts`. This
 * file proves the wiring compiles + renders under the jest-expo preset.
 * Network calls are short-circuited by mounting in offline mode (per
 * DES-0005 §7.1 — the toggle is disabled when offline, so the saving /
 * untagging effects never fire).
 */

import React from "react";
import { render } from "@testing-library/react-native";

import ReceiptDetailScreen from "../../../src/screens/receipt/ReceiptDetailScreen";
import type { CacheableReceipt } from "../../../src/cache/types";
import { setLocale } from "../../../src/lib/i18n";

function makeReceipt(overrides: Partial<CacheableReceipt> = {}): CacheableReceipt {
  return {
    id: "rcp-1",
    country_code: "GR",
    merchant_name: "Σκλαβενίτης",
    merchant_afm: "094319684",
    merchant_address: "Λεωφ. Κηφισίας 100",
    document_number: "INV-001",
    mark: "400000000000001",
    issue_date: "2026-05-04",
    transmission_timestamp: "2026-05-04T12:34:56+03:00",
    payment_method: "Κάρτα",
    provider: "Entersoft",
    subtotal: "10.00",
    discount: "0.00",
    surcharge: "0.00",
    total: "12.40",
    net_value: "10.00",
    vat_total: "2.40",
    is_business_expense: false,
    business_category: null,
    notes: null,
    created_at: "2026-05-04T12:35:00+03:00",
    items: [
      {
        id: "li-1",
        ean: "5201234567890",
        description: "Γάλα φρέσκο 1L",
        unit: "τεμ.",
        quantity: "2",
        unit_price: "1.50",
        pre_discount_value: "3.00",
        discount: "0.00",
        vat_rate: "13",
        total_value: "3.39",
        inferred_category: null,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  setLocale("el");
});

describe("ReceiptDetailScreen", () => {
  it("renders the merchant header, items section, and totals (Greek-first)", () => {
    const { getByText, getAllByText } = render(
      <ReceiptDetailScreen
        receipt={makeReceipt()}
        bearerToken="t"
        backendUrl="http://localhost:9999"
        onAuthError={() => {}}
        isOffline
      />
    );
    // Header
    expect(getByText("Σκλαβενίτης")).toBeTruthy();
    // Section labels (Greek)
    expect(getByText("Είδη")).toBeTruthy();
    expect(getByText("Σύνολα")).toBeTruthy();
    expect(getByText("Καθαρή αξία")).toBeTruthy();
    expect(getByText("ΦΠΑ")).toBeTruthy();
    // "Σύνολο" appears once as a totals label.
    expect(getAllByText("Σύνολο").length).toBeGreaterThanOrEqual(1);
    // Line item description rendered.
    expect(getByText("Γάλα φρέσκο 1L")).toBeTruthy();
  });

  it("renders the tag panel toggle in untagged state", () => {
    const { getByLabelText } = render(
      <ReceiptDetailScreen
        receipt={makeReceipt({ is_business_expense: false })}
        bearerToken="t"
        backendUrl="http://localhost:9999"
        onAuthError={() => {}}
        isOffline
      />
    );
    const toggle = getByLabelText("Επαγγελματικό έξοδο");
    expect(toggle).toBeTruthy();
    expect(toggle.props.accessibilityState.checked).toBe(false);
  });

  it("renders the tag panel summary row when already tagged", () => {
    const { getByLabelText, getByText } = render(
      <ReceiptDetailScreen
        receipt={makeReceipt({
          is_business_expense: true,
          business_category: "groceries",
          notes: "client meeting",
        })}
        bearerToken="t"
        backendUrl="http://localhost:9999"
        onAuthError={() => {}}
        isOffline
      />
    );
    const toggle = getByLabelText("Επαγγελματικό έξοδο");
    expect(toggle.props.accessibilityState.checked).toBe(true);
    // Summary row shows the saved category (DES-0005 §3.3).
    expect(getByText(/groceries/)).toBeTruthy();
    expect(getByText("client meeting")).toBeTruthy();
  });
});
