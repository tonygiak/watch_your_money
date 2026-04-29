import { getLocale, setLocale, t } from "../../src/lib/i18n";

describe("i18n", () => {
  beforeEach(() => setLocale("el"));

  it("returns Greek by default", () => {
    expect(getLocale()).toBe("el");
    expect(t("home.title")).toBe("Οι αποδείξεις μου");
  });

  it("falls back to English when a key is missing in the active locale", () => {
    setLocale("en");
    expect(t("home.title")).toBe("My receipts");
  });

  it("returns the key itself when neither locale has it", () => {
    expect(t("does.not.exist")).toBe("does.not.exist");
  });

  it("keeps Greek UTF-8 round-trip exact", () => {
    const greekTitle = t("home.title", "el");
    expect(greekTitle).toContain("αποδείξεις");
  });
});
