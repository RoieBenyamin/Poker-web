/**
 * settlement.ts – balance check + minimum-transactions settlement algorithm.
 *
 * All internal math is done in integer agorot (cents).
 */
import type { Session, Transfer } from '../types';
import { fromCents, toCents } from './money';

export interface PlayerLine {
  playerId: string;
  buyIn: number;
  buyInCount: number;
  cashOut: number | null;
  /** cashOut - buyIn (raw, before balance adjustment). null if not cashed out. */
  net: number | null;
}

export interface SessionTotals {
  totalIn: number;
  totalOut: number;
  /** totalOut - totalIn (only counting cashed-out players' cash-outs) */
  diff: number;
  playerCount: number;
  cashedOutCount: number;
  allCashedOut: boolean;
}

export interface SimpleTransfer {
  from: string;
  to: string;
  amount: number;
}

/* ------------------------------------------------------------------ */
/* Per-session totals                                                  */
/* ------------------------------------------------------------------ */

export function playerLines(session: Session): PlayerLine[] {
  return session.players.map((sp) => {
    const mine = session.buyIns.filter((b) => b.playerId === sp.playerId);
    const buyInC = mine.reduce((a, b) => a + toCents(b.amount), 0);
    const cashOut = sp.cashOut;
    return {
      playerId: sp.playerId,
      buyIn: fromCents(buyInC),
      buyInCount: mine.length,
      cashOut,
      net: cashOut == null ? null : fromCents(toCents(cashOut) - buyInC),
    };
  });
}

export function sessionTotals(session: Session): SessionTotals {
  const lines = playerLines(session);
  const inC = lines.reduce((a, l) => a + toCents(l.buyIn), 0);
  const outC = lines.reduce((a, l) => a + (l.cashOut == null ? 0 : toCents(l.cashOut)), 0);
  const cashedOutCount = lines.filter((l) => l.cashOut != null).length;
  return {
    totalIn: fromCents(inC),
    totalOut: fromCents(outC),
    diff: fromCents(outC - inC),
    playerCount: lines.length,
    cashedOutCount,
    allCashedOut: lines.length > 0 && cashedOutCount === lines.length,
  };
}

/* ------------------------------------------------------------------ */
/* Balance adjustment                                                  */
/* ------------------------------------------------------------------ */

/**
 * When the pot does not balance (sum of nets != 0) and the user approves anyway,
 * we scale down the larger side (winners or losers) proportionally so that the
 * nets sum to exactly zero. Uses the largest-remainder method so the result is
 * exact in agorot.
 */
export function balanceNetsCents(nets: Record<string, number>): Record<string, number> {
  const entries = Object.entries(nets);
  const P = entries.filter(([, v]) => v > 0).reduce((a, [, v]) => a + v, 0);
  const N = entries.filter(([, v]) => v < 0).reduce((a, [, v]) => a - v, 0);
  if (P === N) return { ...nets };

  const scalePositive = P > N;
  const from = scalePositive ? P : N;
  const target = scalePositive ? N : P;
  const side = entries.filter(([, v]) => (scalePositive ? v > 0 : v < 0));

  const scaled = side.map(([id, v]) => {
    const exact = (Math.abs(v) * target) / from;
    return { id, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let remainder = target - scaled.reduce((a, s) => a + s.floor, 0);
  scaled.sort((a, b) => b.frac - a.frac);
  for (const s of scaled) {
    if (remainder <= 0) break;
    s.floor += 1;
    remainder -= 1;
  }

  const out: Record<string, number> = { ...nets };
  for (const s of scaled) out[s.id] = scalePositive ? s.floor : -s.floor;
  return out;
}

/* ------------------------------------------------------------------ */
/* Minimum transactions                                                */
/* ------------------------------------------------------------------ */

const MAX_EXACT = 16;

/** Greedy: biggest debtor pays biggest creditor. At most n-1 transfers. */
function greedySettle(nets: [string, number][]): SimpleTransfer[] {
  const debtors = nets.filter(([, v]) => v < 0).map(([id, v]) => ({ id, amt: -v }));
  const creditors = nets.filter(([, v]) => v > 0).map(([id, v]) => ({ id, amt: v }));
  const result: SimpleTransfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.amt - a.amt);
    creditors.sort((a, b) => b.amt - a.amt);
    const d = debtors[0];
    const c = creditors[0];
    const pay = Math.min(d.amt, c.amt);
    if (pay > 0) result.push({ from: d.id, to: c.id, amount: pay });
    d.amt -= pay;
    c.amt -= pay;
    if (d.amt === 0) debtors.shift();
    if (c.amt === 0) creditors.shift();
  }
  return result;
}

/**
 * Splits the balances into the MAXIMUM number of disjoint zero-sum groups
 * (bitmask DP). Each group of size k can be settled with k-1 transfers, so the
 * total number of transfers (n - groups) is the true minimum.
 */
function zeroSumGroups(nets: [string, number][]): [string, number][][] {
  const n = nets.length;
  const full = (1 << n) - 1;
  const sum = new Float64Array(1 << n);
  const dp = new Int16Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    const i = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low] + nets[i][1];
    let best = 0;
    for (let j = 0; j < n; j++) {
      if (mask & (1 << j)) {
        const v = dp[mask ^ (1 << j)];
        if (v > best) best = v;
      }
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }

  // Reconstruct: walk down from the full mask, cutting a group at every zero-sum mask.
  const groups: [string, number][][] = [];
  let mask = full;
  let current: number[] = [];
  while (mask) {
    const bonus = sum[mask] === 0 ? 1 : 0;
    let pick = -1;
    for (let j = 0; j < n; j++) {
      if (mask & (1 << j) && dp[mask ^ (1 << j)] + bonus === dp[mask]) {
        pick = j;
        break;
      }
    }
    // Before removing, if this mask is zero-sum, it closes the previously collected group.
    if (sum[mask] === 0 && current.length) {
      groups.push(current.map((k) => nets[k]));
      current = [];
    }
    current.push(pick);
    mask ^= 1 << pick;
  }
  if (current.length) groups.push(current.map((k) => nets[k]));
  return groups;
}

/**
 * Computes the minimal list of transfers that settles all balances.
 * @param nets playerId -> net result in ₪ (must sum to 0; will be balanced if not)
 */
export function minimizeTransfers(nets: Record<string, number>): SimpleTransfer[] {
  let cents: Record<string, number> = {};
  for (const [id, v] of Object.entries(nets)) cents[id] = toCents(v);
  cents = balanceNetsCents(cents);

  const nonZero = Object.entries(cents).filter(([, v]) => v !== 0);
  if (nonZero.length === 0) return [];

  let transfers: SimpleTransfer[];
  if (nonZero.length <= MAX_EXACT) {
    transfers = zeroSumGroups(nonZero).flatMap((g) => greedySettle(g));
  } else {
    transfers = greedySettle(nonZero);
  }
  return transfers
    .map((t) => ({ ...t, amount: fromCents(t.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/* ------------------------------------------------------------------ */
/* Close a session                                                     */
/* ------------------------------------------------------------------ */

export interface SettlementResult {
  results: Record<string, number>;
  transfers: Transfer[];
  diff: number;
}

let idCounter = 0;
const tid = () => `t_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

/** Computes final (balanced) results + transfers for a session whose players all cashed out. */
export function settleSession(session: Session): SettlementResult {
  const lines = playerLines(session);
  const raw: Record<string, number> = {};
  for (const l of lines) raw[l.playerId] = toCents((l.cashOut ?? 0) - l.buyIn);
  const balanced = balanceNetsCents(raw);

  const results: Record<string, number> = {};
  for (const [id, c] of Object.entries(balanced)) results[id] = fromCents(c);

  const transfers: Transfer[] = minimizeTransfers(results).map((t) => ({
    id: tid(),
    from: t.from,
    to: t.to,
    amount: t.amount,
    paid: false,
    paidAt: null,
  }));

  return { results, transfers, diff: sessionTotals(session).diff };
}
