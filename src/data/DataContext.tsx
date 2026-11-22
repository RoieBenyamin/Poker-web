import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Player, PokerGroup, Session } from '../types';
import type { AuthUserInfo, DataMode, DataService } from './DataService';
import { createDataService } from './index';
import { uid } from '../lib/format';
import { roundMoney } from '../lib/money';
import { settleSession, sessionTotals } from '../lib/settlement';

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
  authReady: boolean;
  authUser: AuthUserInfo | null;
  error: string | null;
  mode: DataMode | null;
  me: Player | null;
  meId: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
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
  const isAdmin = () => Boolean(group?.members.some((m) => m.role === 'admin' && m.userId === service?.userId));
  const positive = (amount: number) => {
    const v = roundMoney(amount);
    if (!Number.isFinite(v) || v < 0) throw new Error('סכום לא תקין');
    return v;
  };

  return {
    async createGroup(name: string, defaultBuyIn: number, emoji?: string) {
      const userId = service?.userId;
      if (!meId || !userId) throw new Error('יש להתחבר לחשבון לפני יצירת קבוצה');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('יש להזין שם לקבוצה');
      const amount = positive(defaultBuyIn);
      if (amount === 0) throw new Error('סכום הכניסה חייב להיות גדול מ-0');
      const member = {
        playerId: meId,
        userId,
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
      const userId = service?.userId;
      if (!meId || !userId) throw new Error('יש להתחבר לחשבון לפני הצטרפות לקבוצה');
      const normalized = code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(normalized)) throw new Error('קוד ההזמנה חייב להכיל 6 תווים');
      await svc().joinGroup(normalized, {
        playerId: meId,
        userId,
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
    async updatePlayer(player: Player) {
      if (player.id !== meId) throw new Error('אפשר לערוך רק את הפרופיל שלך');
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
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupIdState] = useState<string | null>(() => localStorage.getItem(GROUP_KEY));

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let unsubAuth: (() => void) | undefined;
    let cancelled = false;
    createDataService()
      .then((svc) => {
        if (cancelled) return;
        setService(svc);
        try {
          unsubAuth = svc.subscribeAuth(
            (user) => {
              setAuthUser(user);
              setAuthReady(true);
              setError(null);
              if (!user) {
                setData({ groups: [], players: [], sessions: [] });
                setReady(true);
              }
            },
            (e) => {
              setError(e.message);
              setAuthReady(true);
              setReady(true);
            },
          );
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
        } catch (e) {
          setError(e instanceof Error ? e.message : 'שגיאה באתחול שירות הנתונים');
          setAuthReady(true);
        } finally {
          setReady(true);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'שגיאה באתחול שירות הנתונים');
        setAuthReady(true);
        setReady(true);
      });
    return () => {
      cancelled = true;
      unsub?.();
      unsubAuth?.();
    };
  }, []);
  const userId = authUser?.uid ?? service?.userId;
  const currentMeId = userId
    ? data.players.find((player) => player.userId === userId)?.id
      ?? data.groups.flatMap((group) => group.members).find((member) => member.userId === userId)?.playerId
      ?? (authUser ? `p_${authUser.uid}` : null)
    : null;
  const setGroupId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(GROUP_KEY, id);
    else localStorage.removeItem(GROUP_KEY);
    setGroupIdState(id);
  }, []);
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!service) throw new Error('שירות הנתונים עדיין לא מוכן');
    const user = await service.signInWithEmail(email, password);
    setAuthUser(user);
    setAuthReady(true);
    setError(null);
  }, [service]);
  const signUpWithEmail = useCallback(async (displayName: string, email: string, password: string) => {
    if (!service) throw new Error('שירות הנתונים עדיין לא מוכן');
    const user = await service.signUpWithEmail(displayName, email, password);
    setAuthUser(user);
    setAuthReady(true);
    setError(null);
  }, [service]);
  const sendPasswordReset = useCallback(async (email: string) => {
    if (!service) throw new Error('שירות הנתונים עדיין לא מוכן');
    await service.sendPasswordReset(email);
  }, [service]);
  const signOut = useCallback(async () => {
    if (!service) throw new Error('שירות הנתונים עדיין לא מוכן');
    await service.signOut();
  }, [service]);
  useEffect(() => {
    if (!ready) return;
    if (!groupId && data.groups.length > 0) setGroupId(data.groups[0].id);
    else if (groupId && !data.groups.some((group) => group.id === groupId)) {
      setGroupId(data.groups[0]?.id ?? null);
    }
  }, [ready, data.groups, groupId, setGroupId]);

  const value = useMemo<DataContextValue>(() => {
    const authPlayer: Player | null = authUser
      ? {
          id: currentMeId ?? `p_${authUser.uid}`,
          userId: authUser.uid,
          name: authUser.displayName?.trim() || authUser.email?.split('@')[0] || 'שחקן',
          ...(authUser.displayName ? { displayName: authUser.displayName } : {}),
          ...(authUser.email ? { email: authUser.email } : {}),
          ...(authUser.photoURL ? { photoURL: authUser.photoURL } : {}),
          createdAt: new Date().toISOString(),
        }
      : null;
    const playersWithAuthFallback = authPlayer && !data.players.some((player) => player.id === authPlayer.id)
      ? [...data.players, authPlayer]
      : data.players;
    const activeGroup = data.groups.find((g) => g.id === groupId) ?? null;
    const memberIds = new Set(activeGroup?.members.map((m) => m.playerId) ?? []);
    const scopedPlayers = activeGroup
      ? playersWithAuthFallback.filter((p) => memberIds.has(p.id) || p.groupIds?.includes(activeGroup.id) || p.userId === authUser?.uid)
      : playersWithAuthFallback;
    const scopedSessions = activeGroup ? data.sessions.filter((s) => s.groupId === activeGroup.id) : [];
    const playerMap = new Map(scopedPlayers.map((p) => [p.id, p]));
    const sessionMap = new Map(scopedSessions.map((s) => [s.id, s]));
    const me = currentMeId ? playersWithAuthFallback.find((p) => p.id === currentMeId) ?? null : null;
    const isGroupAdmin = Boolean(activeGroup?.members.some((m) => m.role === 'admin' && m.userId === service?.userId));
    return {
      groups: data.groups,
      players: scopedPlayers,
      sessions: scopedSessions,
      allSessions: data.sessions,
      activeGroup,
      groupId: activeGroup?.id ?? null,
      isGroupAdmin,
      ready,
      authReady,
      authUser,
      error,
      mode: service?.mode ?? null,
      me,
      meId: currentMeId,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      signOut,
      setGroupId,
      getSession: (id) => sessionMap.get(id),
      getPlayer: (id) => playerMap.get(id),
      actions: buildActions(service, currentMeId, activeGroup),
    };
  }, [data, ready, authReady, authUser, error, service, currentMeId, signInWithEmail, signUpWithEmail, sendPasswordReset, signOut, groupId, setGroupId]);

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
