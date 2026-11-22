import { useState } from 'react';
import { Plus, Spade } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Header } from '../components/Header';
import { LiveSession } from '../components/LiveSession';
import { NewSessionSheet } from '../components/NewSessionSheet';
import { SessionCard } from '../components/SessionCard';
import { Button, EmptyState, SectionTitle } from '../components/ui';
import { sessionStatus, sortByDateDesc } from '../lib/stats';

/** "Active table" tab: shows the live game (or lets you choose / open one). */
export function ActiveTableScreen() {
  const { sessions } = useData();
  const [newOpen, setNewOpen] = useState(false);
  const live = sessions.filter((s) => s.phase === 'active').sort(sortByDateDesc);
  const pending = sessions.filter((s) => sessionStatus(s) === 'pending').sort(sortByDateDesc).slice(0, 3);

  if (live.length === 1) return <LiveSession session={live[0]} />;

  return (
    <>
      <Header title="שולחן פעיל" subtitle={live.length ? `${live.length} משחקים פעילים` : 'אין משחק פעיל כרגע'} />
      <div className="px-4 pt-4">
        {live.length > 1 ? (
          <>
            <SectionTitle>בחר שולחן</SectionTitle>
            <div className="space-y-2.5">
              {live.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Spade size={30} />}
            title="אין משחק פעיל"
            text="פתחו משחק חדש ושתפו את הקישור עם החברים כדי שכל אחד יזין כניסות ויציאות מהטלפון."
            action={
              <Button size="lg" onClick={() => setNewOpen(true)}>
                <Plus size={22} />
                פתח משחק חדש
              </Button>
            }
          />
        )}

        {pending.length > 0 && (
          <>
            <SectionTitle>ממתינים לתשלומים</SectionTitle>
            <div className="space-y-2.5">
              {pending.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          </>
        )}
      </div>
      {newOpen && <NewSessionSheet open onClose={() => setNewOpen(false)} />}
    </>
  );
}
