/**
 * Minimal i18n with Greek as default and English as fallback.
 * Every user-facing string flows through this module.
 *
 * See `.agents/rules/localization-conventions.md`.
 */

export type Locale = "el" | "en";

type StringTable = Record<string, string>;

const STRINGS: Record<Locale, StringTable> = {
  el: {
    "app.name": "Έξυπνες Αποδείξεις",
    "home.title": "Οι αποδείξεις μου",
    "home.empty": "Καμία απόδειξη ακόμα — σαρώστε ένα QR.",
    "scanner.cta": "Σάρωση απόδειξης",
    "common.loading": "Φόρτωση…",
    "common.error.generic": "Κάτι πήγε στραβά. Δοκιμάστε ξανά.",
  },
  en: {
    "app.name": "Smart Receipts",
    "home.title": "My receipts",
    "home.empty": "No receipts yet — scan a QR.",
    "scanner.cta": "Scan receipt",
    "common.loading": "Loading…",
    "common.error.generic": "Something went wrong. Please try again.",
  },
};

let currentLocale: Locale = "el";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, locale: Locale = currentLocale): string {
  const table = STRINGS[locale];
  if (table[key] !== undefined) return table[key]!;
  const fallback = STRINGS.en[key];
  if (fallback !== undefined) return fallback;
  return key;
}
