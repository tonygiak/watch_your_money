import { sanitizeForCache } from "../../src/cache/sanitizer";

const FULL_RECEIPT = {
  id: "11111111-2222-3333-4444-555555555555",
  country_code: "GR",
  merchant_name: "ALPHA SUPER MARKET",
  merchant_afm: "999999999",
  merchant_address: "ΑΘΗΝΑ",
  document_number: "Α/00001",
  mark: "400000000000001",
  issue_date: "2026-04-30",
  transmission_timestamp: "2026-04-30T12:00:00+03:00",
  payment_method: "ΜΕΤΡΗΤΑ",
  provider: "ENTERSOFT",
  subtotal: "10.00",
  discount: "0.00",
  surcharge: "0.00",
  total: "10.00",
  net_value: "8.06",
  vat_total: "1.94",
  is_business_expense: false,
  business_category: null,
  notes: null,
  created_at: "2026-04-30T12:00:01+03:00",
  items: [
    {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      ean: "5201360123456",
      description: "ΓΑΛΑ ΦΡΕΣΚΟ 1L",
      unit: "ΤΕΜ",
      quantity: "1",
      unit_price: "1.45",
      pre_discount_value: "1.45",
      discount: "0.00",
      vat_rate: "13.00",
      total_value: "1.45",
      inferred_category: null,
    },
  ],
};

describe("sanitizeForCache — ADR-0006 §5 default-deny", () => {
  it("preserves every documented cacheable field", () => {
    const out = sanitizeForCache(FULL_RECEIPT);
    expect(out).not.toBeNull();
    expect(out!.id).toBe(FULL_RECEIPT.id);
    expect(out!.merchant_name).toBe("ALPHA SUPER MARKET");
    expect(out!.items.length).toBe(1);
    expect(out!.items[0]!.description).toBe("ΓΑΛΑ ΦΡΕΣΚΟ 1L");
  });

  it("never includes raw_html (server-only)", () => {
    const polluted = { ...FULL_RECEIPT, raw_html: "<html>SECRET</html>" };
    const out = sanitizeForCache(polluted);
    expect(out).not.toBeNull();
    expect(JSON.stringify(out)).not.toContain("SECRET");
    expect(JSON.stringify(out)).not.toContain("raw_html");
  });

  it("drops unknown top-level fields silently", () => {
    const polluted = {
      ...FULL_RECEIPT,
      jwt: "eyJhbGciOiJIUzI1NiJ9.x.y",
      refresh_token: "secret-refresh",
      phone: "+306912345678",
    };
    const out = sanitizeForCache(polluted);
    expect(out).not.toBeNull();
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(serialized).not.toContain("secret-refresh");
    expect(serialized).not.toContain("+306912345678");
  });

  it("drops unknown line-item fields silently", () => {
    const polluted = {
      ...FULL_RECEIPT,
      items: [
        {
          ...FULL_RECEIPT.items[0],
          loyalty_points: 99,
          customer_card_number: "999-XYZ",
        },
      ],
    };
    const out = sanitizeForCache(polluted);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("999-XYZ");
    expect(serialized).not.toContain("loyalty_points");
  });

  it("returns null on missing id / merchant / issue_date", () => {
    const noId = { ...FULL_RECEIPT, id: "" };
    const noMerchant = { ...FULL_RECEIPT, merchant_name: "" };
    const noDate = { ...FULL_RECEIPT, issue_date: "" };
    expect(sanitizeForCache(noId)).toBeNull();
    expect(sanitizeForCache(noMerchant)).toBeNull();
    expect(sanitizeForCache(noDate)).toBeNull();
  });

  it("returns null on non-object inputs", () => {
    expect(sanitizeForCache(null)).toBeNull();
    expect(sanitizeForCache(undefined)).toBeNull();
    expect(sanitizeForCache("not an object")).toBeNull();
    expect(sanitizeForCache(42)).toBeNull();
    expect(sanitizeForCache([1, 2, 3])).toBeNull();
  });

  it("coerces numeric money fields into decimal-as-string", () => {
    const numericMoney = {
      ...FULL_RECEIPT,
      total: 12.5,
      vat_total: 1,
      items: [{ ...FULL_RECEIPT.items[0], unit_price: 1.45 }],
    };
    const out = sanitizeForCache(numericMoney);
    expect(out!.total).toBe("12.50");
    expect(out!.vat_total).toBe("1.00");
    expect(out!.items[0]!.unit_price).toBe("1.45");
  });

  it("preserves Greek characters end-to-end", () => {
    const greek = {
      ...FULL_RECEIPT,
      merchant_name: "ΦΑΡΜΑΚΕΙΟ ΚΕΝΤΡΟ",
      items: [
        {
          ...FULL_RECEIPT.items[0],
          description: "ΨΩΜΙ ΟΛΙΚΗΣ ΑΛΕΣΗΣ",
        },
      ],
    };
    const out = sanitizeForCache(greek);
    expect(out!.merchant_name).toBe("ΦΑΡΜΑΚΕΙΟ ΚΕΝΤΡΟ");
    expect(out!.items[0]!.description).toBe("ΨΩΜΙ ΟΛΙΚΗΣ ΑΛΕΣΗΣ");
  });

  it("normalizes business_category and notes empty strings to null", () => {
    const polluted = {
      ...FULL_RECEIPT,
      business_category: "",
      notes: "",
    };
    const out = sanitizeForCache(polluted);
    expect(out!.business_category).toBeNull();
    expect(out!.notes).toBeNull();
  });
});
