import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Settings, Spade, X } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Header } from '../components/Header';
import { NewSessionSheet } from '../components/NewSessionSheet';
import { SessionCard } from '../components/SessionCard';
import { Button, Card, cx, EmptyState, IconButton, SectionTitle, Segmented } from '../components/ui';
import { sessionStatus, sortByDateDesc } from '../lib/stats';
import { fmtLongDate, fmtMonth, sameDay } from '../lib/format';
import { navigate } from '../lib/router';
import { sessionTotals } from '../lib/settlement';
import { formatMoney } from '../lib/money';
import type { Session, SessionStatus } from '../types';

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const DOT: Record<SessionStatus, string> = { active: 'bg-emerald-400', pending: 'bg-amber-400', settled: 'bg-slate-400' };

function MonthGrid({
  month,
  sessions,
  selected,
  onSelect,
}: {
  month: Date;
  sessions: Session[];
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const today = new Date();

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-slate-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const games = sessions.filter((s) => sameDay(new Date(s.date), d));
          const isSel = selected && sameDay(selected, d);
          const isToday = sameDay(today, d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelect(d)}
              className={cx(
                'flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors',
                isSel ? 'bg-red-600 text-white font-bold' : games.length ? 'bg-slate-800/80 font-semibold' : 'text-slate-400 hover:bg-slate-800/40',
                isToday && !isSel && 'ring-1 ring-red-500/60',
              )}
            >
              <span className="num">{d.getDate()}</span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {games.slice(0, 3).map((g) => (
                  <span key={g.id} className={cx('h-1.5 w-1.5 rounded-full',                   isSel ? 'bg-white' : DOT[sessionStatus(g)])} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarScreen() {
  const { sessions } = useData();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const sorted = useMemo(() => [...sessions].sort(sortByDateDesc), [sessions]);
  const live = sorted.filter((s) => s.phase === 'active');

  const filtered = useMemo(() => {
    if (view === 'calendar') {
      if (selectedDay) return sorted.filter((s) => sameDay(new Date(s.date), selectedDay));
      return sorted.filter((s) => {
        const d = new Date(s.date);
        return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
      });
    }
    return sorted;
  }, [sorted, view, selectedDay, month]);

  // Group list view by month
  const groups = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of filtered) {
      const d = new Date(s.date);
      const key = fmtMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [filtered]);

  const shiftMonth = (delta: number) => {
    setSelectedDay(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  return (
    <>
      <Header
        title="יומן משחקים"
        subtitle={`${sessions.length} משחקים`}
        actions={
          <IconButton label="הגדרות" onClick={() => navigate('/settings')}>
            <Settings size={22} />
          </IconButton>
        }
      />
      <div className="px-4 pt-4">
        <Button size="lg" block onClick={() => setNewOpen(true)}>
          <Plus size={24} strokeWidth={2.6} />
          פתח משחק חדש
        </Button>

        {live.map((s) => {
          const t = sessionTotals(s);
          return (
            <Card
              key={s.id}
              onClick={() => navigate(`/session/${s.id}`)}
              className="mt-3 flex items-center gap-3 !border-red-500/40 !bg-gradient-to-l from-red-950/70 to-slate-900/70"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-300">
                <Spade size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="live-dot h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  משחק פעיל עכשיו
                </div>
                <div className="text-sm text-slate-300">
                  {t.playerCount} שחקנים · קופה <span className="num">{formatMoney(t.totalIn)}</span>
                </div>
              </div>
              <ChevronLeft className="text-red-300" />
            </Card>
          );
        })}

        <div className="mt-5">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'calendar', label: 'תצוגת יומן' },
              { value: 'list', label: 'כל המשחקים' },
            ]}
          />
        </div>

        {view === 'calendar' && (
          <Card className="mt-3">
            <div className="mb-3 flex items-center justify-between">
              <IconButton label="חודש קודם" onClick={() => shiftMonth(-1)}>
                <ChevronRight size={22} />
              </IconButton>
              <span className="font-semibold">{fmtMonth(month)}</span>
              <IconButton label="חודש הבא" onClick={() => shiftMonth(1)}>
                <ChevronLeft size={22} />
              </IconButton>
            </div>
            <MonthGrid
              month={month}
              sessions={sessions}
              selected={selectedDay}
              onSelect={(d) => setSelectedDay((cur) => (cur && sameDay(cur, d) ? null : d))}
            />
            <div className="mt-3 flex justify-center gap-4 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />פעיל</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />ממתין לתשלומים</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />סגור ושולם</span>
            </div>
          </Card>
        )}

        {view === 'calendar' && selectedDay && (
          <SectionTitle
            action={
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
                <X size={16} />
                נקה
              </Button>
            }
          >
            {fmtLongDate(selectedDay.toISOString())}
          </SectionTitle>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={view === 'calendar' ? <CalendarDays size={30} /> : <List size={30} />}
            title={selectedDay ? 'אין משחקים ביום הזה' : 'אין משחקים בתקופה הזו'}
            text="זה הזמן לארגן ערב פוקר 🃏"
            action={
              selectedDay && (
                <Button variant="outline" onClick={() => setNewOpen(true)}>
                  <Plus size={18} />
                  פתח משחק
                </Button>
              )
            }
          />
        ) : (
          groups.map(([label, list]) => (
            <div key={label}>
              {!selectedDay && <SectionTitle>{label}</SectionTitle>}
              <div className="space-y-2.5">
                {list.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {newOpen && (
        <NewSessionSheet
          open
          onClose={() => setNewOpen(false)}
          defaultDate={selectedDay ? withNowTime(selectedDay) : undefined}
        />
      )}
    </>
  );
}

function withNowTime(day: Date): Date {
  const now = new Date();
  if (sameDay(day, now)) return now;
  const d = new Date(day);
  d.setHours(21, 0, 0, 0);
  return d;
}
