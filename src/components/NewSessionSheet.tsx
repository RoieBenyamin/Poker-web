import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { useData } from '../data/DataContext';
import { useRun } from './Toast';
import { Button, cx, Field, inputCls, MoneyInput, Sheet } from './ui';
import { PlayerPicker } from './PlayerPicker';
import { fromLocalInput, toLocalInput } from '../lib/format';
import { parseAmount } from '../lib/money';
import { navigate } from '../lib/router';

const PRESETS = [50, 100, 200];

export function NewSessionSheet({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate?: Date }) {
  const { actions, meId, sessions, activeGroup } = useData();
  const run = useRun();
  // Default buy-in = the one used in the most recent game
  const lastBuyIn = activeGroup?.defaultBuyIn ?? [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0]?.buyInAmount ?? 50;

  const [date, setDate] = useState(() => toLocalInput((defaultDate ?? new Date()).toISOString()));
  const [amount, setAmount] = useState(String(lastBuyIn));
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string[]>(meId ? [meId] : []);
  const [autoBuyIn, setAutoBuyIn] = useState(true);
  const [busy, setBusy] = useState(false);

  const parsed = parseAmount(amount);
  const valid = parsed !== null && parsed > 0;

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const create = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const id = await run(
      () =>
        actions.createSession({
          date: fromLocalInput(date),
          buyInAmount: parsed!,
          location,
          note,
          playerIds: selected,
          autoBuyIn,
        }),
      'המשחק נפתח – בהצלחה! 🍀',
    );
    setBusy(false);
    if (id) {
      onClose();
      navigate(`/session/${id}`);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="פתיחת משחק חדש"
      footer={
        <Button block size="lg" onClick={create} disabled={!valid || busy}>
          <PlayCircle size={22} />
          פתח משחק{selected.length ? ` עם ${selected.length} שחקנים` : ''}
        </Button>
      }
    >
      <div className="space-y-5">
        <Field label="תאריך ושעה">
          <input type="datetime-local" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="סכום כניסה סטנדרטי" hint={!valid && amount !== '' ? 'יש להזין סכום חיובי' : undefined}>
          <div className="mb-2 flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={cx(
                  'num h-11 flex-1 rounded-xl border text-base font-semibold transition-colors',
                  parsed === p ? 'border-red-500 bg-red-500/15 text-red-300' : 'border-slate-700 text-slate-300',
                )}
              >
                {p}₪
              </button>
            ))}
          </div>
          <MoneyInput value={amount} onChange={setAmount} placeholder="סכום מותאם" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="מיקום (אופציונלי)">
            <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="אצל דני" maxLength={40} />
          </Field>
          <Field label="הערה (אופציונלי)">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="1/2 NLH" maxLength={60} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">מי משחק?</span>
            <span className="text-xs text-slate-500">אפשר להוסיף גם תוך כדי משחק</span>
          </div>
          <PlayerPicker selected={selected} onToggle={toggle} />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <input
            type="checkbox"
            checked={autoBuyIn}
            onChange={(e) => setAutoBuyIn(e.target.checked)}
            className="h-5 w-5 accent-red-500"
          />
          <span className="text-sm text-slate-300">לרשום לכל שחקן כניסה ראשונה אוטומטית</span>
        </label>
      </div>
    </Sheet>
  );
}
