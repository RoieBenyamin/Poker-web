/**
 * localStorage implementation – used when Firebase is not configured
 * (dev environment / offline). Syncs between tabs via the `storage` event.
 */
import type { AppData, Player, PokerGroup, Session } from '../types';
import type { DataService } from './DataService';

const KEY = 'poker.data.v2';

function read(): AppData {
  localStorage.removeItem('poker.data.v1');
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (Array.isArray(parsed.groups) && Array.isArray(parsed.players) && Array.isArray(parsed.sessions)) return parsed;
    }
  } catch {
    localStorage.removeItem(KEY);
  }
  return { groups: [], players: [], sessions: [] };
}

export function createLocalService(): DataService {
  let data = read();
  const listeners = new Set<(d: AppData) => void>();

  const emit = () => listeners.forEach((l) => l(data));
  const write = (next: AppData) => {
    data = next;
    localStorage.setItem(KEY, JSON.stringify(data));
    emit();
  };

  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      data = read();
      emit();
    }
  });

  return {
    mode: 'local',
    get userId() {
      let id = localStorage.getItem('poker.localUser');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('poker.localUser', id);
      }
      return id;
    },
    subscribe(cb) {
      listeners.add(cb);
      cb(data);
      return () => listeners.delete(cb);
    },
    async upsertPlayer(player: Player) {
      const exists = data.players.some((p) => p.id === player.id);
      write({
        ...data,
        players: exists ? data.players.map((p) => (p.id === player.id ? player : p)) : [...data.players, player],
      });
    },
    async createGroup(group: PokerGroup) {
      if (data.groups.some((g) => g.inviteCode === group.inviteCode)) throw new Error('קוד ההזמנה כבר קיים');
      write({
        ...data,
        players: data.players.map((p) => p.id === group.members[0]?.playerId
          ? { ...p, groupIds: [...new Set([...(p.groupIds ?? []), group.id])] }
          : p),
        groups: [...data.groups, group],
      });
    },
    async joinGroup(code, member) {
      const group = data.groups.find((g) => g.inviteCode.toUpperCase() === code.toUpperCase());
      if (!group) throw new Error('קוד ההזמנה לא נמצא');
      if (group.members.some((m) => m.userId === member.userId || m.playerId === member.playerId)) return;
      write({
        ...data,
        players: data.players.map((p) => p.id === member.playerId
          ? { ...p, groupIds: [...new Set([...(p.groupIds ?? []), group.id])] }
          : p),
        groups: data.groups.map((g) =>
          g.id === group.id ? { ...g, members: [...g.members, { ...member, role: 'member' }] } : g,
        ),
      });
    },
    async updateGroup(id, mutate) {
      const current = data.groups.find((g) => g.id === id);
      if (!current) throw new Error('הקבוצה לא נמצאה');
      const next = mutate(structuredClone(current));
      write({ ...data, groups: data.groups.map((g) => (g.id === id ? next : g)) });
    },
    async createSession(session: Session) {
      write({ ...data, sessions: [...data.sessions, session] });
    },
    async updateSession(id, mutate) {
      const current = data.sessions.find((s) => s.id === id);
      if (!current) throw new Error('המשחק לא נמצא');
      const next = mutate(structuredClone(current));
      write({ ...data, sessions: data.sessions.map((s) => (s.id === id ? next : s)) });
    },
    async deleteSession(id) {
      write({ ...data, sessions: data.sessions.filter((s) => s.id !== id) });
    },
  };
}
