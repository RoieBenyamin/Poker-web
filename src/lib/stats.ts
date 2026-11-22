/**
 * stats.ts – per-player statistics, recent-N averages, debts and leaderboard.
 */
import type { Player, Session, SessionStatus, Transfer } from '../types';
import { fromCents, toCents } from './money';
import { playerLines } from './settlement';

export function sessionStatus(s: Session): SessionStatus {
  if (s.phase === 'active') return 'active';
  return s.transfers.some((t) => !t.paid) ? 'pending' : 'settled';
}

export const sortByDateDesc = (a: Session, b: Session) => b.date.localeCompare(a.date);

export interface GameResult {
  sessionId: string;
  date: string;
  location?: string;
  buyIn: number;
  buyInCount: number;
  cashOut: number;
  net: number;
}

/** All closed games of a player, newest first. */
export function playerResults(sessions: Session[], playerId: string): GameResult[] {
  return sessions
    .filter((s) => s.phase === 'closed' && s.players.some((p) => p.playerId === playerId))
    .sort(sortByDateDesc)
    .map((s) => {
      const line = playerLines(s).find((l) => l.playerId === playerId)!;
      const net = s.results?.[playerId] ?? line.net ?? 0;
      return {
        sessionId: s.id,
        date: s.date,
        location: s.location,
        buyIn: line.buyIn,
        buyInCount: line.buyInCount,
        cashOut: line.cashOut ?? 0,
        net,
      };
    });
}

export type RangeOption = number | 'all';

export interface RecentSummary {
  /** number of games actually included */
  count: number;
  total: number;
  average: number;
  wins: number;
  winRate: number; // 0..100
  best: number;
  worst: number;
  games: GameResult[]; // newest first
}

/** Summary of the last N games (results must be newest first). */
export function recentSummary(results: GameResult[], range: RangeOption): RecentSummary {
  const games = range === 'all' ? results : results.slice(0, Math.max(0, Math.floor(range)));
  const count = games.length;
  const totalC = games.reduce((a, g) => a + toCents(g.net), 0);
  const wins = games.filter((g) => toCents(g.net) > 0).length;
  return {
    count,
    total: fromCents(totalC),
    average: count ? fromCents(Math.round(totalC / count)) : 0,
    wins,
    winRate: count ? Math.round((wins / count) * 100) : 0,
    best: count ? Math.max(...games.map((g) => g.net)) : 0,
    worst: count ? Math.min(...games.map((g) => g.net)) : 0,
    games,
  };
}

/* ------------------------------------------------------------------ */
/* Debts                                                               */
/* ------------------------------------------------------------------ */

export interface OpenDebt extends Transfer {
  sessionId: string;
  sessionDate: string;
  daysAgo: number;
}

export function daysSince(iso: string, now = new Date()): number {
  const d = new Date(iso);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((today - start) / 86_400_000));
}

export function openDebts(sessions: Session[]): OpenDebt[] {
  const out: OpenDebt[] = [];
  for (const s of sessions) {
    if (s.phase !== 'closed') continue;
    for (const t of s.transfers) {
      if (!t.paid) out.push({ ...t, sessionId: s.id, sessionDate: s.date, daysAgo: daysSince(s.date) });
    }
  }
  return out.sort((a, b) => b.daysAgo - a.daysAgo || b.amount - a.amount);
}

export function playerDebtSummary(sessions: Session[], playerId: string) {
  const debts = openDebts(sessions);
  const owedToMe = debts.filter((d) => d.to === playerId);
  const iOwe = debts.filter((d) => d.from === playerId);
  const sum = (list: OpenDebt[]) => fromCents(list.reduce((a, d) => a + toCents(d.amount), 0));
  return { owedToMe, iOwe, owedToMeTotal: sum(owedToMe), iOweTotal: sum(iOwe) };
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

export interface LeaderRow {
  player: Player;
  games: number;
  total: number;
  average: number;
  winRate: number;
}

export function leaderboard(players: Player[], sessions: Session[]): LeaderRow[] {
  return players
    .map((player) => {
      const s = recentSummary(playerResults(sessions, player.id), 'all');
      return { player, games: s.count, total: s.total, average: s.average, winRate: s.winRate };
    })
    .filter((r) => r.games > 0)
    .sort((a, b) => b.total - a.total || b.average - a.average);
}
