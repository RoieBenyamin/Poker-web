import type { AppData, Player, PokerGroup, Session } from '../types';

export type DataMode = 'firebase' | 'local';

/**
 * Storage-agnostic data service. Implemented by Firestore (real-time sync between
 * friends' phones) and by localStorage (dev / offline fallback).
 */
export interface DataService {
  readonly mode: DataMode;
  readonly userId?: string;
  /** Subscribes to all data; the callback fires immediately and on every change. */
  subscribe(cb: (data: AppData) => void, onError?: (e: Error) => void): () => void;
  upsertPlayer(player: Player): Promise<void>;
  createGroup(group: PokerGroup): Promise<void>;
  joinGroup(code: string, member: PokerGroup['members'][number]): Promise<void>;
  updateGroup(id: string, mutate: (group: PokerGroup) => PokerGroup): Promise<void>;
  createSession(session: Session): Promise<void>;
  /** Atomic read-modify-write of a single session (transaction in Firestore). */
  updateSession(id: string, mutate: (s: Session) => Session): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
