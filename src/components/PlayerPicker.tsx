import { Check } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Avatar, cx } from './ui';

/**
 * Multi-select list of members of the selected group.
 * `exclude` hides players (e.g. already at the table).
 */
export function PlayerPicker({
  selected,
  onToggle,
  exclude = [],
  allowedIds,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  exclude?: string[];
  allowedIds?: string[];
}) {
  const { players, meId, activeGroup } = useData();
  const memberIds = new Set(activeGroup?.members.map((member) => member.playerId) ?? []);
  const list = players
    .filter((player) => memberIds.has(player.id))
    .filter((p) => !exclude.includes(p.id))
    .filter((p) => !allowedIds || allowedIds.includes(p.id))
    .sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name, 'he')));

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {list.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              className={cx(
                'flex h-14 items-center gap-2.5 rounded-2xl border px-3 text-right transition-colors',
                on ? 'border-red-500/60 bg-red-500/10' : 'border-slate-800 bg-slate-950/40 active:bg-slate-800',
              )}
            >
              <Avatar name={p.name} id={p.id} photoURL={p.photoURL} size="sm" />
              <span className="flex-1 truncate font-medium">
                {p.name}
                {p.id === meId && <span className="text-xs text-slate-500"> (אני)</span>}
              </span>
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                  on ? 'border-red-500 bg-red-600 text-white' : 'border-slate-600',
                )}
              >
                {on && <Check size={15} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
        {list.length === 0 && <p className="col-span-2 py-3 text-center text-sm text-slate-500">כל החברים כבר ברשימה</p>}
      </div>

    </div>
  );
}
