import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { AppData, Player, PokerGroup, Session } from '../types';
import type { DataService } from './DataService';

function groupData(group: PokerGroup): Omit<PokerGroup, 'members'> {
  const { members: _members, ...data } = group;
  return data;
}

export async function createFirebaseService(config: FirebaseOptions): Promise<DataService> {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const credential = await signInAnonymously(auth);
  const userId = credential.user.uid;
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
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
        if (ownPlayer) players.set(ownPlayer.id, ownPlayer);
        playersByGroup.forEach((list) => list.forEach((player) => players.set(player.id, player)));
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
                  const session = { ...(sessionDoc.data() as Session), id: sessionDoc.id };
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
      await setDoc(doc(usersCol, userId), { ...player, userId });
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
      await setDoc(doc(db, 'groups', session.groupId, 'sessions', session.id), session);
      sessionGroupIds.set(session.id, session.groupId);
    },
    async updateSession(id, mutate) {
      const groupId = sessionGroupIds.get(id);
      if (!groupId) throw new Error('המשחק לא נמצא בקבוצה הנוכחית');
      const ref = doc(db, 'groups', groupId, 'sessions', id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('המשחק לא נמצא');
        tx.set(ref, mutate({ ...(snap.data() as Session), id }));
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

async function ownProfile(db: ReturnType<typeof initializeFirestore>, userId: string): Promise<DocumentData> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) throw new Error('הפרופיל לא נמצא. יש להתחבר מחדש.');
  return snap.data();
}
