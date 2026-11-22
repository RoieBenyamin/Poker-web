import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getFirestore,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { AppData, BuyIn, Player, PokerGroup, Session, SessionPlayer, Transfer } from '../types';
import type { DataService } from './DataService';

let servicePromise: Promise<DataService> | undefined;

function groupData(group: PokerGroup): Omit<PokerGroup, 'members'> {
  const { members: _members, ...data } = group;
  return data;
}

function encodeSession(session: Session): DocumentData {
  const players = Object.fromEntries(session.players.map((player) => [player.playerId, player]));
  const buyIns = session.buyIns.reduce<Record<string, BuyIn[]>>((byPlayer, buyIn) => {
    (byPlayer[buyIn.playerId] ??= []).push(buyIn);
    return byPlayer;
  }, {});
  const transfers = Object.fromEntries(session.transfers.map(({ id, from, to, amount }) => [
    id,
    { id, from, to, amount },
  ]));
  const paidByPlayer = session.transfers.reduce<Record<string, Record<string, { paid: boolean; paidAt?: string | null }>>>((byPlayer, transfer) => {
    (byPlayer[transfer.from] ??= {})[transfer.id] = { paid: transfer.paid, paidAt: transfer.paidAt ?? null };
    return byPlayer;
  }, {});
  return { ...session, players, buyIns, transfers, paidByPlayer };
}

function decodeSession(data: DocumentData, id: string): Session {
  const players = Array.isArray(data.players)
    ? data.players as SessionPlayer[]
    : Object.values((data.players ?? {}) as Record<string, SessionPlayer>);
  const buyIns = Array.isArray(data.buyIns)
    ? data.buyIns as BuyIn[]
    : Object.values((data.buyIns ?? {}) as Record<string, BuyIn[]>).flat();
  const transferRecords = Array.isArray(data.transfers)
    ? data.transfers as Transfer[]
    : Object.values((data.transfers ?? {}) as Record<string, Transfer>);
  const payments = (data.paidByPlayer ?? {}) as Record<string, Record<string, { paid: boolean; paidAt?: string | null }>>;
  const transfers = transferRecords.map((transfer) => ({
    ...transfer,
    ...(payments[transfer.from]?.[transfer.id] ?? {}),
  }));
  return { ...data, id, players, buyIns, transfers } as Session;
}

export function createFirebaseService(config: FirebaseOptions): Promise<DataService> {
  if (!servicePromise) servicePromise = initializeFirebaseService(config);
  return servicePromise;
}

async function initializeFirebaseService(config: FirebaseOptions): Promise<DataService> {
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const credential = await signInAnonymously(auth);
  const userId = credential.user.uid;
  const db = getFirestore(app);
  const groupsCol = collection(db, 'groups');
  const usersCol = collection(db, 'users');
  const sessionGroupIds = new Map<string, string>();

  return {
    mode: 'firebase',
    userId,
    subscribe(cb, onError) {
      const state: AppData = { groups: [], players: [], sessions: [] };
      const groupMembers = new Map<string, PokerGroup['members']>();
      const groupDocs = new Map<string, Omit<PokerGroup, 'members'>>();
      const playersByGroup = new Map<string, Player[]>();
      const sessionsByGroup = new Map<string, Session[]>();
      let ownPlayer: Player | null = null;
      let groupUnsubs: Array<() => void> = [];
      let activeGroupIds = '';
      const emit = () => {
        const players = new Map<string, Player>();
        const mergePlayer = (player: Player) => {
          const current = players.get(player.id);
          players.set(player.id, {
            ...current,
            ...player,
            groupIds: [...new Set([...(current?.groupIds ?? []), ...(player.groupIds ?? [])])],
          });
        };
        if (ownPlayer) mergePlayer(ownPlayer);
        playersByGroup.forEach((list) => list.forEach(mergePlayer));
        const sessions = [...sessionsByGroup.values()].flat();
        state.groups = [...groupDocs.entries()].flatMap(([id, group]) => {
          const members = groupMembers.get(id);
          return members ? [{ ...group, id, members }] : [];
        });
        state.players = [...players.values()];
        state.sessions = sessions;
        cb({ groups: [...state.groups], players: [...state.players], sessions: [...state.sessions] });
      };
      const fail = (error: Error) => onError?.(error);

      const ownPlayerUnsub = onSnapshot(
        doc(usersCol, userId),
        (snap) => {
          ownPlayer = snap.exists() ? (snap.data() as Player) : null;
          emit();
        },
        fail,
      );
      const memberQuery = query(collectionGroup(db, 'members'), where('userId', '==', userId));
      const membersUnsub = onSnapshot(
        memberQuery,
        (snap) => {
          const ids = [...new Set(snap.docs.map((d) => d.ref.parent.parent?.id).filter((id): id is string => Boolean(id)))];
          const nextKey = ids.sort().join(',');
          if (nextKey !== activeGroupIds) {
            activeGroupIds = nextKey;
            groupUnsubs.forEach((unsub) => unsub());
            groupUnsubs = [];
            groupDocs.clear();
            groupMembers.clear();
            playersByGroup.clear();
            sessionsByGroup.clear();
            for (const id of ids) {
              const groupRef = doc(groupsCol, id);
              groupUnsubs.push(onSnapshot(groupRef, (groupSnap) => {
                if (groupSnap.exists()) groupDocs.set(id, groupSnap.data() as Omit<PokerGroup, 'members'>);
                else groupDocs.delete(id);
                emit();
              }, fail));
              groupUnsubs.push(onSnapshot(collection(groupRef, 'members'), (memberSnap) => {
                groupMembers.set(id, memberSnap.docs.map((memberDoc) => ({
                  ...(memberDoc.data() as PokerGroup['members'][number]),
                  userId: memberDoc.id,
                })));
                emit();
              }, fail));
              groupUnsubs.push(onSnapshot(collection(groupRef, 'players'), (playerSnap) => {
                playersByGroup.set(id, playerSnap.docs.map((playerDoc) => playerDoc.data() as Player));
                emit();
              }, fail));
              groupUnsubs.push(onSnapshot(collection(groupRef, 'sessions'), (sessionSnap) => {
                const list = sessionSnap.docs.map((sessionDoc) => {
                  const session = decodeSession(sessionDoc.data(), sessionDoc.id);
                  sessionGroupIds.set(session.id, id);
                  return session;
                });
                sessionsByGroup.set(id, list);
                emit();
              }, fail));
            }
          }
          emit();
        },
        fail,
      );
      return () => {
        ownPlayerUnsub();
        membersUnsub();
        groupUnsubs.forEach((unsub) => unsub());
      };
    },
    async upsertPlayer(player: Player) {
      const profile = { ...player, userId };
      await setDoc(doc(usersCol, userId), profile);
      const memberships = await getDocs(query(collectionGroup(db, 'members'), where('userId', '==', userId)));
      const batch = writeBatch(db);
      memberships.docs.forEach((member) => {
        const groupId = member.ref.parent.parent?.id;
        if (groupId) {
          batch.set(doc(db, 'groups', groupId, 'players', player.id), {
            ...profile,
            groupIds: [groupId],
          });
        }
      });
      if (!memberships.empty) await batch.commit();
    },
    async createGroup(group) {
      if ((await getDoc(doc(db, 'invites', group.inviteCode))).exists()) throw new Error('קוד ההזמנה כבר קיים. נסה שוב.');
      const batch = writeBatch(db);
      batch.set(doc(groupsCol, group.id), groupData(group));
      const member = group.members[0];
      batch.set(doc(db, 'groups', group.id, 'members', userId), { ...member, userId });
      batch.set(doc(db, 'groups', group.id, 'players', member.playerId), {
        ...(await ownProfile(db, userId)),
        userId,
        groupIds: [group.id],
      });
      batch.set(doc(db, 'invites', group.inviteCode), { groupId: group.id, inviteCode: group.inviteCode });
      await batch.commit();
    },
    async joinGroup(code, member) {
      const inviteSnap = await getDoc(doc(db, 'invites', code));
      if (!inviteSnap.exists()) throw new Error('קוד ההזמנה לא נמצא');
      const groupId = String(inviteSnap.data().groupId);
      const memberRef = doc(db, 'groups', groupId, 'members', userId);
      const existing = await getDoc(memberRef);
      if (existing.exists()) return;
      const profile = await ownProfile(db, userId);
      const batch = writeBatch(db);
      batch.set(memberRef, { ...member, userId, role: 'member', invitationCode: code });
      batch.set(doc(db, 'groups', groupId, 'players', member.playerId), { ...profile, userId, groupIds: [groupId] });
      await batch.commit();
    },
    async updateGroup(id, mutate) {
      const groupRef = doc(groupsCol, id);
      const [groupSnap, memberSnap] = await Promise.all([
        getDoc(groupRef),
        getDocs(collection(groupRef, 'members')),
      ]);
      if (!groupSnap.exists()) throw new Error('הקבוצה לא נמצאה');
      const current: PokerGroup = {
        ...(groupSnap.data() as Omit<PokerGroup, 'members'>),
        id,
        members: memberSnap.docs.map((d) => ({ ...(d.data() as PokerGroup['members'][number]), userId: d.id })),
      };
      const next = mutate(current);
      if (next.inviteCode !== current.inviteCode && (await getDoc(doc(db, 'invites', next.inviteCode))).exists()) {
        throw new Error('קוד ההזמנה כבר קיים. נסה שוב.');
      }
      const batch = writeBatch(db);
      batch.set(groupRef, groupData(next));
      const nextIds = new Set(next.members.map((m) => m.userId));
      memberSnap.docs.forEach((d) => {
        if (!nextIds.has(d.id)) batch.delete(d.ref);
      });
      next.members.forEach((member) => {
        batch.set(doc(db, 'groups', id, 'members', member.userId), member);
      });
      if (next.inviteCode !== current.inviteCode) {
        batch.delete(doc(db, 'invites', current.inviteCode));
        batch.set(doc(db, 'invites', next.inviteCode), { groupId: id, inviteCode: next.inviteCode });
      }
      await batch.commit();
    },
    async createSession(session) {
      await setDoc(doc(db, 'groups', session.groupId, 'sessions', session.id), encodeSession(session));
      sessionGroupIds.set(session.id, session.groupId);
    },
    async updateSession(id, mutate) {
      const groupId = sessionGroupIds.get(id);
      if (!groupId) throw new Error('המשחק לא נמצא בקבוצה הנוכחית');
      const ref = doc(db, 'groups', groupId, 'sessions', id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('המשחק לא נמצא');
        tx.set(ref, encodeSession(mutate(decodeSession(snap.data(), id))));
      });
    },
    async deleteSession(id) {
      const groupId = sessionGroupIds.get(id);
      if (!groupId) throw new Error('המשחק לא נמצא בקבוצה הנוכחית');
      await deleteDoc(doc(db, 'groups', groupId, 'sessions', id));
      sessionGroupIds.delete(id);
    },
  };
}

async function ownProfile(db: ReturnType<typeof getFirestore>, userId: string): Promise<DocumentData> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) throw new Error('הפרופיל לא נמצא. יש להתחבר מחדש.');
  return snap.data();
}
