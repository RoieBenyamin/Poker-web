import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Player, PokerGroup, Session } from '../types';
import type { DataMode, DataService } from './DataService';
import { createDataService } from './index';
import { uid } from '../lib/format';
import { roundMoney } from '../lib/money';
import { settleSession, sessionTotals } from '../lib/settlement';

const ME_KEY = 'poker.me';
const GROUP_KEY = 'poker.group';

export interface NewSessionInput {
  date: string;
  buyInAmount: number;
  location?: string;
  note?: string;
  playerIds: string[];
  autoBuyIn: boolean;
}

interface DataContextValue extends AppData {
  allSessions: Session[];
  activeGroup: PokerGroup | null;
  groupId: string | null;
  isGroupAdmin: boolean;
  setGroupId: (id: string | null) => void;
  ready: boolean;
  error: string | null;
  mode: DataMode | null;
  me: Player | null;
  meId: string | null;
  setMeId: (id: string | null) => void;
  getSession: (id: string) => Session | undefined;
  getPlayer: (id: string) => Player | undefined;
  actions: ReturnType<typeof buildActions>;
}

const DataContext = createContext<DataContextValue | null>(null);

const nowIso = () => new Date().toISOString();

/** Domain operations – each one is an atomic mutation on the data service. */
function buildActions(service: DataService | null, meId: string | null, group: PokerGroup | null) {
  const svc = () => {
    if (!service) throw new Error('שירות הנתונים עדיין לא מוכן');
    return service;
  };
  const update = (id: string, fn: (s: Session) => Session) => svc().updateSession(id, fn);
  const assertActive = (s: Session) => {
    if (s.phase !== 'active') throw new Error('המשחק כבר נסגר');
  };
  const assertAdmin = () => {
    if (!isAdmin()) {
      throw new Error('הפעולה זמינה למנהלי הקבוצה בלבד');
    }
  };
  const isAdmin = () => Boolean(group?.members.some((m) => m.playerId === meId && m.role === 'admin'));
  const positive = (amount: number) => {
    const v = roundMoney(amount);
    if (!Number.isFinite(v) || v < 0) throw new Error('סכום לא תקין');
    return v;
  };

  return {
    async createGroup(name: string, defaultBuyIn: number, emoji?: string) {
      if (!meId) throw new Error('יש ליצור פרופיל לפני יצירת קבוצה');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('יש להזין שם לקבוצה');
      const amount = positive(defaultBuyIn);
      if (amount === 0) throw new Error('סכום הכניסה חייב להיות גדול מ-0');
      const member = {
        playerId: meId,
        userId: service?.userId ?? meId,
        role: 'admin' as const,
        joinedAt: nowIso(),
      };
      const newGroup: PokerGroup = {
        id: uid('g_'),
        name: trimmed,
        defaultBuyIn: amount,
        inviteCode: newInviteCode(),
        createdAt: nowIso(),
        createdBy: member.userId,
        members: [member],
      };
      if (emoji?.trim()) newGroup.emoji = emoji.trim();
      await svc().createGroup(newGroup);
      return newGroup.id;
    },
    async joinGroup(code: string) {
      if (!meId) throw new Error('יש ליצור פרופיל לפני הצטרפות לקבוצה');
      const normalized = code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(normalized)) throw new Error('קוד ההזמנה חייב להכיל 6 תווים');
      await svc().joinGroup(normalized, {
        playerId: meId,
        userId: service?.userId ?? meId,
        role: 'member',
        joinedAt: nowIso(),
      });
    },
    async setMemberRole(playerId: string, role: 'admin' | 'member') {
      assertAdmin();
      if (!group) throw new Error('לא נבחרה קבוצה');
      if (role === 'member' && group.members.filter((m) => m.role === 'admin').length === 1
        && group.members.some((m) => m.playerId === playerId && m.role === 'admin')) {
        throw new Error('חייב להישאר לפחות מנהל אחד בקבוצה');
      }
      await svc().updateGroup(group.id, (current) => ({
        ...current,
        members: current.members.map((m) => (m.playerId === playerId ? { ...m, role } : m)),
      }));
    },
    async removeGroupMember(playerId: string) {
      assertAdmin();
      if (!group) throw new Error('לא נבחרה קבוצה');
      if (playerId === meId) throw new Error('אי אפשר להסיר את עצמך מהקבוצה');
      await svc().updateGroup(group.id, (current) => ({
        ...current,
        members: current.members.filter((m) => m.playerId !== playerId),
      }));
    },
    async resetInviteCode() {
      assertAdmin();
      if (!group) throw new Error('לא נבחרה קבוצה');
      const inviteCode = newInviteCode();
      await svc().updateGroup(group.id, (current) => ({ ...current, inviteCode }));
    },
    async createPlayer(name: string, phone?: string): Promise<Player> {
      if (group && !isAdmin()) throw new Error('רק מנהל יכול להוסיף שחקן לקבוצה');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('יש להזין שם');
      const player: Player = { id: uid('p_'), name: trimmed, createdAt: nowIso() };
      if (phone?.trim()) player.phone = phone.trim();
      await svc().upsertPlayer(player);
      return player;
    },
    async updatePlayer(player: Player) {
      if (player.id !== meId && !isAdmin()) throw new Error('אפשר לערוך רק את הפרופיל שלך');
      await svc().upsertPlayer(player);
    },
    async createSession(input: NewSessionInput): Promise<string> {
      assertAdmin();
      if (!group) throw new Error('יש לבחור קבוצה לפני פתיחת משחק');
      const at = nowIso();
      const amount = positive(input.buyInAmount);
      if (input.playerIds.some((playerId) => !group.members.some((member) => member.playerId === playerId))) {
        throw new Error('אפשר להוסיף למשחק רק חברים בקבוצה');
      }
      const session: Session = {
        id: uid('s_'),
        groupId: group.id,
        date: input.date,
        buyInAmount: amount,
        phase: 'active',
        players: input.playerIds.map((playerId) => ({ playerId, joinedAt: at, cashOut: null, cashOutAt: null })),
        buyIns: input.autoBuyIn && amount > 0
          ? input.playerIds.map((playerId) => ({ id: uid('b_'), playerId, amount, at }))
          : [],
        transfers: [],
        createdAt: at,
        createdBy: meId,
      };
      if (input.location?.trim()) session.location = input.location.trim();
      if (input.note?.trim()) session.note = input.note.trim();
      await svc().createSession(session);
      return session.id;
    },
    updateSessionInfo(id: string, patch: Partial<Pick<Session, 'date' | 'buyInAmount' | 'location' | 'note'>>) {
      assertAdmin();
      return update(id, (s) => ({ ...s, ...patch, buyInAmount: positive(patch.buyInAmount ?? s.buyInAmount) }));
    },
    addPlayerToSession(id: string, playerId: string, withBuyIn: boolean) {
      if (playerId !== meId && !isAdmin()) throw new Error('אפשר להצטרף למשחק רק בשם עצמך');
      return update(id, (s) => {
        assertActive(s);
        if (s.players.some((p) => p.playerId === playerId)) return s;
        const at = nowIso();
        return {
          ...s,
          players: [...s.players, { playerId, joinedAt: at, cashOut: null, cashOutAt: null }],
          buyIns: withBuyIn && s.buyInAmount > 0
            ? [...s.buyIns, { id: uid('b_'), playerId, amount: s.buyInAmount, at }]
            : s.buyIns,
        };
      });
    },
    removePlayerFromSession(id: string, playerId: string) {
      assertAdmin();
      return update(id, (s) => {
        assertActive(s);
        if (!s.players.some((p) => p.playerId === playerId)) throw new Error('השחקן אינו נמצא במשחק');
        return {
          ...s,
          players: s.players.filter((p) => p.playerId !== playerId),
          buyIns: s.buyIns.filter((b) => b.playerId !== playerId),
        };
      });
    },
    addBuyIn(id: string, playerId: string, amount: number) {
      if (playerId !== meId && !isAdmin()) throw new Error('אפשר לרשום כניסה רק לעצמך');
      const v = positive(amount);
      if (v === 0) throw new Error('סכום הכניסה חייב להיות גדול מ-0');
      return update(id, (s) => {
        assertActive(s);
        if (!s.players.some((p) => p.playerId === playerId)) throw new Error('השחקן אינו נמצא במשחק');
        return {
          ...s,
          // a rebuy after cashing out puts the player back in the game
          players: s.players.map((p) => (p.playerId === playerId ? { ...p, cashOut: null, cashOutAt: null } : p)),
          buyIns: [...s.buyIns, { id: uid('b_'), playerId, amount: v, at: nowIso() }],
        };
      });
    },
    updateBuyIn(id: string, buyInId: string, patch: { amount?: number; at?: string }) {
      assertAdmin();
      return update(id, (s) => {
        assertActive(s);
        return {
          ...s,
          buyIns: s.buyIns.map((b) =>
            b.id === buyInId
              ? { ...b, ...(patch.amount != null ? { amount: positive(patch.amount) } : {}), ...(patch.at ? { at: patch.at } : {}) }
              : b,
          ),
        };
      });
    },
    deleteBuyIn(id: string, buyInId: string) {
      assertAdmin();
      return update(id, (s) => {
        assertActive(s);
        return { ...s, buyIns: s.buyIns.filter((b) => b.id !== buyInId) };
      });
    },
    setCashOut(id: string, playerId: string, amount: number | null) {
      if (playerId !== meId && !isAdmin()) throw new Error('אפשר לעדכן יציאה רק לעצמך');
      const v = amount == null ? null : positive(amount);
      return update(id, (s) => {
        assertActive(s);
        if (!s.players.some((p) => p.playerId === playerId)) throw new Error('השחקן אינו נמצא במשחק');
        return {
          ...s,
          players: s.players.map((p) =>
            p.playerId === playerId ? { ...p, cashOut: v, cashOutAt: v == null ? null : nowIso() } : p,
          ),
        };
      });
    },
    closeSession(id: string) {
      assertAdmin();
      return update(id, (s) => {
        assertActive(s);
        const totals = sessionTotals(s);
        if (!totals.allCashedOut) throw new Error('לא כל השחקנים הזינו יציאה');
        const { results, transfers, diff } = settleSession(s);
        return { ...s, phase: 'closed', results, transfers, approvedDiff: diff || 0, closedAt: nowIso() };
      });
    },
    reopenSession(id: string) {
      assertAdmin();
      return update(id, (s) => ({
        ...s,
        phase: 'active',
        transfers: [],
        results: undefined,
        approvedDiff: 0,
        closedAt: null,
      }));
    },
    setTransferPaid(id: string, transferId: string, paid: boolean) {
      return update(id, (s) => {
        const transfer = s.transfers.find((t) => t.id === transferId);
        if (!transfer) throw new Error('ההעברה לא נמצאה');
        if (transfer.from !== meId && !isAdmin()) throw new Error('אפשר לסמן תשלום רק עבור חוב שלך');
        return {
          ...s,
          transfers: s.transfers.map((t) => (t.id === transferId ? { ...t, paid, paidAt: paid ? nowIso() : null } : t)),
        };
      });
    },
    deleteSession(id: string) {
      assertAdmin();
      return svc().deleteSession(id);
    },
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [service, setService] = useState<DataService | null>(null);
  const [data, setData] = useState<AppData>({ groups: [], players: [], sessions: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeIdState] = useState<string | null>(() => localStorage.getItem(ME_KEY));
  const [groupId, setGroupIdState] = useState<string | null>(() => localStorage.getItem(GROUP_KEY));

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    createDataService()
      .then((svc) => {
        if (cancelled) return;
        setService(svc);
        unsub = svc.subscribe(
          (d) => {
            setData(d);
            setReady(true);
          },
          (e) => {
            setError(e.message);
            setReady(true);
          },
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'שגיאה באתחול שירות הנתונים');
        setReady(true);
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const firebasePlayerId = service?.mode === 'firebase'
    ? data.players.find((p) => p.userId === service.userId)?.id
      ?? data.groups.flatMap((g) => g.members).find((m) => m.userId === service.userId)?.playerId
      ?? null
    : null;
  const currentMeId = service?.mode === 'firebase' ? firebasePlayerId : meId;
  const setMeId = useCallback((id: string | null) => {
    if (service?.mode === 'firebase' && id && firebasePlayerId && id !== firebasePlayerId) return;
    if (id) localStorage.setItem(ME_KEY, id);
    else localStorage.removeItem(ME_KEY);
    setMeIdState(id);
  }, [service, firebasePlayerId]);
  const setGroupId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(GROUP_KEY, id);
    else localStorage.removeItem(GROUP_KEY);
    setGroupIdState(id);
  }, []);

  const value = useMemo<DataContextValue>(() => {
    const activeGroup = data.groups.find((g) => g.id === groupId) ?? null;
    const memberIds = new Set(activeGroup?.members.map((m) => m.playerId) ?? []);
    const scopedPlayers = activeGroup ? data.players.filter((p) => memberIds.has(p.id)) : data.players;
    const scopedSessions = activeGroup ? data.sessions.filter((s) => s.groupId === activeGroup.id) : [];
    const playerMap = new Map(scopedPlayers.map((p) => [p.id, p]));
    const sessionMap = new Map(scopedSessions.map((s) => [s.id, s]));
    const me = currentMeId ? data.players.find((p) => p.id === currentMeId) ?? null : null;
    const isGroupAdmin = Boolean(activeGroup?.members.some((m) => m.role === 'admin'
      && (service?.mode === 'firebase' ? m.userId === service.userId : m.playerId === currentMeId)));
    return {
      groups: data.groups,
      players: scopedPlayers,
      sessions: scopedSessions,
      allSessions: data.sessions,
      activeGroup,
      groupId: activeGroup?.id ?? null,
      isGroupAdmin,
      ready,
      error,
      mode: service?.mode ?? null,
      me,
      meId: currentMeId,
      setMeId,
      setGroupId,
      getSession: (id) => sessionMap.get(id),
      getPlayer: (id) => playerMap.get(id),
      actions: buildActions(service, currentMeId, activeGroup),
    };
  }, [data, ready, error, service, currentMeId, setMeId, groupId, setGroupId]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function newInviteCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
