import { formatEur, formatGreekDate } from "../../src/lib/format";

describe("formatEur", () => {
  it("formats positive amounts with comma decimal and trailing euro sign", () => {
    expect(formatEur(2.5)).toBe("2,50 €");
    expect(formatEur(0)).toBe("0,00 €");
  });

  it("formats negative amounts with leading minus", () => {
    expect(formatEur(-3.75)).toBe("-3,75 €");
  });

  it("inserts thousands separator", () => {
    expect(formatEur(1234.5)).toBe("1.234,50 €");
    expect(formatEur(1234567.89)).toBe("1.234.567,89 €");
  });

  it("falls back to zero on non-finite input", () => {
    expect(formatEur(Number.NaN)).toBe("0,00 €");
    expect(formatEur(Number.POSITIVE_INFINITY)).toBe("0,00 €");
  });
});

describe("formatGreekDate", () => {
  it("formats a date as DD-MM-YYYY", () => {
    expect(formatGreekDate(new Date(2026, 3, 28))).toBe("28-04-2026");
    expect(formatGreekDate(new Date(2026, 0, 7))).toBe("07-01-2026");
  });

  it("accepts ISO strings", () => {
    expect(formatGreekDate("2026-04-28T10:00:00Z").length).toBe(10);
  });

  it("returns empty string for invalid input", () => {
    expect(formatGreekDate("not-a-date")).toBe("");
  });
});
