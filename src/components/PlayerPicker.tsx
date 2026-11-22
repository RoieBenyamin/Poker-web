import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useData } from '../data/DataContext';
import { useRun } from './Toast';
import { Avatar, Button, cx, inputCls } from './ui';

/**
 * Multi-select list of friends + quick "new player" inline creation.
 * `exclude` hides players (e.g. already at the table).
 */
export function PlayerPicker({
  selected,
  onToggle,
  exclude = [],
  allowedIds,
  onCreated,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  exclude?: string[];
  allowedIds?: string[];
  onCreated?: (id: string) => void;
}) {
  const { players, actions, meId } = useData();
  const run = useRun();
  const [name, setName] = useState('');
  const list = players
    .filter((p) => !exclude.includes(p.id))
    .filter((p) => !allowedIds || allowedIds.includes(p.id))
    .sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : a.name.localeCompare(b.name, 'he')));

  const exists = players.some((p) => p.name.trim() === name.trim());
  const add = async () => {
    if (!name.trim() || exists) return;
    const p = await run(() => actions.createPlayer(name), `${name.trim()} נוסף לחברים`);
    if (p) {
      setName('');
      (onCreated ?? onToggle)(p.id);
    }
  };

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
              <Avatar name={p.name} id={p.id} size="sm" />
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

      <div className="mt-3 flex gap-2">
        <input
          className={inputCls}
          placeholder="שחקן חדש – שם"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add} disabled={!name.trim() || exists} className="shrink-0">
          <Plus size={20} />
          הוסף
        </Button>
      </div>
      {exists && name.trim() && <p className="mt-1 text-xs text-amber-400">השחקן כבר קיים ברשימה</p>}
    </div>
  );
}
