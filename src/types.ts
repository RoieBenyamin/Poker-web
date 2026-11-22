export interface Player {
  id: string;
  name: string;
  /** Optional phone number for Bit / PayBox */
  phone?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  groupIds?: string[];
  userId?: string;
}

export type GroupRole = 'admin' | 'member';

export interface GroupMember {
  playerId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
}

export interface PokerGroup {
  id: string;
  name: string;
  defaultBuyIn: number;
  inviteCode: string;
  createdAt: string;
  createdBy: string;
  members: GroupMember[];
  emoji?: string;
}

/** A single buy-in / rebuy at the table */
export interface BuyIn {
  id: string;
  playerId: string;
  amount: number;
  /** ISO timestamp */
  at: string;
}

export interface SessionPlayer {
  playerId: string;
  joinedAt: string;
  /** null = still playing / has not cashed out yet */
  cashOut: number | null;
  cashOutAt?: string | null;
}

export interface Transfer {
  id: string;
  from: string; // playerId (loser)
  to: string; // playerId (winner)
  amount: number;
  paid: boolean;
  paidAt?: string | null;
}

export type SessionPhase = 'active' | 'closed';

export interface Session {
  id: string;
  groupId: string;
  /** ISO date-time of the game */
  date: string;
  /** Standard buy-in amount */
  buyInAmount: number;
  location?: string;
  note?: string;
  phase: SessionPhase;
  players: SessionPlayer[];
  buyIns: BuyIn[];
  /** Filled when the game is closed */
  transfers: Transfer[];
  /** Final (possibly balance-adjusted) net result per player – filled on close */
  results?: Record<string, number>;
  /** Difference (cash-outs minus buy-ins) that was approved on close */
  approvedDiff?: number;
  closedAt?: string | null;
  createdAt: string;
  createdBy?: string | null;
}

/** Derived, user-facing status */
export type SessionStatus = 'active' | 'pending' | 'settled';

export interface AppData {
  groups: PokerGroup[];
  players: Player[];
  sessions: Session[];
}
