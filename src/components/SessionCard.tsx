import { ChevronLeft, MapPin, Users } from 'lucide-react';
import type { Session } from '../types';
import { useData } from '../data/DataContext';
import { sessionTotals } from '../lib/settlement';
import { sessionStatus } from '../lib/stats';
import { fmtLongDate, fmtTime } from '../lib/format';
import { navigate } from '../lib/router';
import { Card, Money, StatusBadge } from './ui';

export function SessionCard({ session }: { session: Session }) {
  const { meId } = useData();
  const totals = sessionTotals(session);
  const status = sessionStatus(session);
  const myResult = meId && session.phase === 'closed' ? session.results?.[meId] : undefined;
  const d = new Date(session.date);

  return (
    <Card onClick={() => navigate(`/session/${session.id}`)} className="flex items-center gap-3 !p-3.5">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-800/80">
        <span className="num text-xl font-bold leading-none">{d.getDate()}</span>
        <span className="mt-0.5 text-[11px] text-slate-400">{d.toLocaleDateString('he-IL', { month: 'short' })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{fmtLongDate(session.date)}</span>
          <span className="num text-xs text-slate-500">{fmtTime(session.date)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Users size={13} />
            {totals.playerCount}
          </span>
          <span className="num">קופה {totals.totalIn.toLocaleString('he-IL')}₪</span>
          {session.location && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin size={13} />
              {session.location}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={status} />
          {myResult !== undefined && (
            <span className="text-xs text-slate-400">
              אני: <Money value={myResult} />
            </span>
          )}
        </div>
      </div>
      <ChevronLeft className="shrink-0 text-slate-600" size={20} />
    </Card>
  );
}
