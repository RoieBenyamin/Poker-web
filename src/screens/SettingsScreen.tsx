import { useState } from 'react';
import { Cloud, Download, LogOut, Pencil, Smartphone, Users, UsersRound } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Header } from '../components/Header';
import { PlayerForm } from '../components/PlayerForm';
import { useRun } from '../components/Toast';
import { Avatar, Button, Card, IconButton, SectionTitle, Sheet } from '../components/ui';
import { navigate } from '../lib/router';
import type { Player } from '../types';

export function SettingsScreen() {
  const { me, players, actions, sessions, authUser, signOut } = useData();
  const run = useRun();
  const [editing, setEditing] = useState<Player | null>(null);
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ players, sessions }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `poker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <Header title="הגדרות" back={() => navigate('/me')} />
      <div className="px-4 pt-4">
        {me && (
          <Card className="flex items-center gap-3">
            <Avatar name={me.name} id={me.id} photoURL={me.photoURL} size="lg" />
            <div className="flex-1">
              <div className="text-xs text-slate-400">מחובר כ-</div>
              <div className="text-xl font-bold">{me.name}</div>
              {authUser?.email && <div className="text-sm text-slate-400">{authUser.email}</div>}
              {me.phone && <div className="num text-right text-sm text-slate-400">{me.phone}</div>}
            </div>
            <IconButton label="ערוך פרופיל" onClick={() => setEditing(me)}>
              <Pencil size={20} />
            </IconButton>
          </Card>
        )}
        <Button variant="danger" block className="mt-3" onClick={() => run(signOut, 'התנתקת מחשבון Google')}>
          <LogOut size={18} />
          יציאה מחשבון Google
        </Button>
        <Button variant="outline" block className="mt-2" onClick={() => navigate('/groups')}>
          <UsersRound size={19} />
          הקבוצות שלי וניהול ההזמנות
        </Button>

        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} /> חברים ({players.length})
          </span>
        </SectionTitle>
        <Card className="!p-1.5">
          {sorted.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => p.id === me?.id && setEditing(p)}
              className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-right ${p.id === me?.id ? 'active:bg-slate-800' : ''}`}
            >
              <Avatar name={p.name} id={p.id} photoURL={p.photoURL} size="sm" />
              <span className="flex-1 font-medium">{p.name}</span>
              <span className="num text-sm text-slate-500">{p.phone ?? 'אין טלפון'}</span>
              {p.id === me?.id && <Pencil size={15} className="text-slate-600" />}
            </button>
          ))}
        </Card>

        <SectionTitle>נתונים וסנכרון</SectionTitle>
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
              <Cloud size={22} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">סנכרון בזמן אמת (Firebase)</div>
              <div className="text-xs text-slate-400">כל החברים רואים עדכונים חיים מהטלפונים שלהם</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <Button variant="secondary" size="sm" onClick={exportJson}>
              <Download size={16} />
              ייצוא גיבוי
            </Button>
          </div>
        </Card>

        <SectionTitle>התקנה כאפליקציה</SectionTitle>
        <Card className="flex gap-3 text-sm text-slate-300">
          <Smartphone size={22} className="mt-0.5 shrink-0 text-red-400" />
          <div>
            <p>
              <b>אייפון:</b> Safari ← כפתור השיתוף ← "הוסף למסך הבית".
            </p>
            <p className="mt-1">
              <b>אנדרואיד:</b> Chrome ← תפריט ⋮ ← "התקן אפליקציה".
            </p>
          </div>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-600">פוקר בין חברים · v1.0 ♠️♥️♦️♣️</p>
      </div>

      {editing && (
        <Sheet open onClose={() => setEditing(null)} title={`עריכת ${editing.name}`}>
          <div className="pb-3">
            <PlayerForm
              initialName={editing.name}
              initialPhone={editing.phone ?? ''}
              submitLabel="שמור"
              existingNames={players.filter((p) => p.id !== editing.id).map((p) => p.name)}
              onSubmit={async (name, phone) => {
                const next: Player = { ...editing, name };
                if (phone) next.phone = phone;
                else delete next.phone;
                await run(() => actions.updatePlayer(next), 'הפרטים נשמרו');
                setEditing(null);
              }}
            />
          </div>
        </Sheet>
      )}

    </>
  );
}
