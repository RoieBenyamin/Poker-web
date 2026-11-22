/** Money helpers. All calculations are done in agorot (integer cents) to avoid float errors. */

export const CURRENCY = '₪';

export const toCents = (n: number): number => Math.round((Number(n) || 0) * 100);
export const fromCents = (c: number): number => Math.round(c) / 100;
export const roundMoney = (n: number): number => fromCents(toCents(n));

const numberFmt = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** "1,250₪" (no sign) */
export function formatMoney(n: number): string {
  return `${numberFmt.format(Math.abs(roundMoney(n)))}${CURRENCY}`;
}

/** "+85₪" / "-40₪" / "0₪" */
export function formatSigned(n: number): string {
  const r = roundMoney(n);
  if (r === 0) return `0${CURRENCY}`;
  return `${r > 0 ? '+' : '-'}${formatMoney(r)}`;
}

/** Wraps a signed string with LTR marks so "+85₪" renders correctly in RTL text. */
export function ltr(s: string): string {
  return `\u2066${s}\u2069`;
}

export function moneyTone(n: number): string {
  const r = roundMoney(n);
  if (r > 0) return 'text-green-500';
  if (r < 0) return 'text-red-500';
  return 'text-slate-300';
}

/**
 * Parses user input into a non-negative amount.
 * Returns null for empty / invalid / negative values.
 */
export function parseAmount(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? roundMoney(raw) : null;
  const cleaned = raw.replace(/[,\s₪]/g, '').trim();
  if (cleaned === '') return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null; // rejects "-", letters etc.
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundMoney(n);
}

export const sumMoney = (values: number[]): number => fromCents(values.reduce((a, v) => a + toCents(v), 0));
