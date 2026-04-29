/**
 * Locale-correct formatters for the Greek-first UX.
 *
 * Currency: `X,XX €` (comma decimal, space, euro symbol).
 * Date:     `DD-MM-YYYY` (Greek convention).
 *
 * See `.agents/rules/localization-conventions.md`.
 */

const TWO_DIGIT = (n: number): string => (n < 10 ? `0${n}` : String(n));

export function formatEur(amount: number): string {
  if (!Number.isFinite(amount)) return "0,00 €";
  const sign = amount < 0 ? "-" : "";
  const absolute = Math.abs(amount);
  const integer = Math.floor(absolute);
  const cents = Math.round((absolute - integer) * 100);
  const centsPadded = cents < 10 ? `0${cents}` : `${cents}`;
  const integerWithThousands = integer
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${integerWithThousands},${centsPadded} €`;
}

export function formatGreekDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  const day = TWO_DIGIT(d.getDate());
  const month = TWO_DIGIT(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
