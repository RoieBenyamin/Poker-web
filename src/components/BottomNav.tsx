import { CalendarDays, Spade, UserRound, Trophy, UsersRound } from 'lucide-react';
import { useData } from '../data/DataContext';
import { navigate } from '../lib/router';
import { cx } from './ui';

export type TabKey = 'calendar' | 'table' | 'me' | 'debts' | 'groups';

const TABS: Array<{ key: TabKey; label: string; path: string; Icon: typeof Spade }> = [
  { key: 'groups', label: 'קבוצות', path: '/groups', Icon: UsersRound },
  { key: 'calendar', label: 'יומן', path: '/calendar', Icon: CalendarDays },
  { key: 'table', label: 'שולחן פעיל', path: '/table', Icon: Spade },
  { key: 'me', label: 'האזור שלי', path: '/me', Icon: UserRound },
  { key: 'debts', label: 'חובות ומובילים', path: '/debts', Icon: Trophy },
];

export function BottomNav({ active }: { active: TabKey }) {
  const { sessions } = useData();
  const hasLive = sessions.some((s) => s.phase === 'active');

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5">
        {TABS.map(({ key, label, path, Icon }) => {
          const on = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => navigate(path)}
              className={cx(
                'relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                on ? 'text-red-400' : 'text-slate-500 active:text-slate-300',
              )}
            >
              <span className={cx('relative flex h-8 w-14 items-center justify-center rounded-full transition-colors', on && 'bg-red-500/15')}>
                <Icon size={22} strokeWidth={on ? 2.4 : 2} />
                {key === 'table' && hasLive && (
                  <span className="live-dot absolute right-2.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
