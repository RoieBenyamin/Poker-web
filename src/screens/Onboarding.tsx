import { useEffect, useState } from 'react';
import { ChevronLeft, UserPlus } from 'lucide-react';
import { useData } from '../data/DataContext';
import { useRun } from '../components/Toast';
import { Avatar, Button, Card } from '../components/ui';
import { PlayerForm } from '../components/PlayerForm';
import { navigate } from '../lib/router';

/** First launch: pick "who am I" from the friends list or create a new player. */
export function Onboarding() {
  const { players, setMeId, meId, actions, mode } = useData();
  const run = useRun();
  const [creating, setCreating] = useState(players.length === 0);
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name, 'he'));

  useEffect(() => {
    if (!meId && sorted.length === 1) {
      setMeId(sorted[0].id);
      navigate('/groups');
    }
  }, [meId, setMeId, sorted]);

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10">
      <div className="mt-10 flex flex-col items-center text-center">
        <img src="/icon.svg" alt="" className="h-24 w-24 rounded-[1.75rem] shadow-2xl shadow-red-500/20" />
        <h1 className="mt-5 text-3xl font-extrabold">פוקר בין חברים</h1>
        <p className="mt-2 text-slate-400">כניסות, יציאות, העברות וחובות – הכל במקום אחד.</p>
      </div>

      {!creating ? (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">מי אתה?</h2>
          <div className="space-y-2.5">
            {sorted.map((p) => (
              <Card key={p.id} onClick={() => setMeId(p.id)} className="flex items-center gap-3 !p-3">
                <Avatar name={p.name} id={p.id} />
                <div className="flex-1">
                  <div className="text-lg font-semibold">{p.name}</div>
                  {p.phone && <div className="num text-right text-sm text-slate-500">{p.phone}</div>}
                </div>
                <ChevronLeft className="text-slate-500" />
              </Card>
            ))}
          </div>
          <Button variant="outline" size="lg" block className="mt-5" onClick={() => setCreating(true)}>
            <UserPlus size={20} />
            אני שחקן חדש
          </Button>
        </>
      ) : (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">יצירת שחקן חדש</h2>
          <Card>
            <PlayerForm
              submitLabel="זה אני – בוא נתחיל"
              existingNames={players.map((p) => p.name)}
              onSubmit={async (name, phone) => {
                const p = await run(() => actions.createPlayer(name, phone));
                if (p) {
                  setMeId(p.id);
                  navigate('/groups');
                }
              }}
            />
          </Card>
          {players.length > 0 && (
            <Button variant="ghost" block className="mt-3" onClick={() => setCreating(false)}>
              חזרה לרשימת החברים
            </Button>
          )}
        </>
      )}

      <p className="mt-auto pt-10 text-center text-xs text-slate-600">
        {mode === 'firebase' ? 'מסונכרן בזמן אמת ☁️' : 'מצב מקומי — הנתונים נשמרים במכשיר הזה 💾'}
      </p>
    </div>
  );
}
