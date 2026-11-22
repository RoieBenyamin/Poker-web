import { useState } from 'react';
import { CalendarClock, LogOut, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { Session } from '../types';
import { useData } from '../data/DataContext';
import { useRun } from './Toast';
import { Button, ConfirmSheet, Field, inputCls, MoneyInput, Sheet } from './ui';
import { fromLocalInput, toLocalInput } from '../lib/format';
import { parseAmount } from '../lib/money';
import { navigate } from '../lib/router';

/** "More" menu for a session: edit details, reopen, delete. */
export function SessionMenuSheet({ session, open, onClose }: { session: Session; open: boolean; onClose: () => void }) {
  const { actions, isGroupAdmin } = useData();
  const run = useRun();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'reopen' | null>(null);

  const [date, setDate] = useState(toLocalInput(session.date));
  const [amount, setAmount] = useState(String(session.buyInAmount));
  const [location, setLocation] = useState(session.location ?? '');
  const [note, setNote] = useState(session.note ?? '');
  const parsed = parseAmount(amount);

  if (!isGroupAdmin) return null;

  const save = async () => {
    if (parsed === null || parsed <= 0) return;
    await run(
      () =>
        actions.updateSessionInfo(session.id, {
          date: fromLocalInput(date),
          buyInAmount: parsed,
          location: location.trim(),
          note: note.trim(),
        }),
      'פרטי המשחק עודכנו',
    );
    setEditing(false);
    onClose();
  };

  return (
    <>
      <Sheet
        open={open && !confirm}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
        title={editing ? 'עריכת פרטי משחק' : 'אפשרויות משחק'}
        footer={
          editing ? (
            <div className="flex gap-3">
              <Button variant="secondary" block onClick={() => setEditing(false)}>
                ביטול
              </Button>
              <Button block onClick={save} disabled={parsed === null || parsed <= 0}>
                שמור
              </Button>
            </div>
          ) : undefined
        }
      >
        {editing ? (
          <div className="space-y-4">
            <Field label="תאריך ושעה">
              <input type="datetime-local" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="סכום כניסה סטנדרטי">
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="מיקום">
              <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={40} />
            </Field>
            <Field label="הערה">
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} />
            </Field>
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            <Button variant="secondary" block className="!justify-start" onClick={() => setEditing(true)}>
              {session.phase === 'active' ? <Pencil size={19} /> : <CalendarClock size={19} />}
              עריכת פרטי משחק (תאריך, סכום, מיקום)
            </Button>
            {session.phase === 'closed' && (
              <Button variant="secondary" block className="!justify-start" onClick={() => setConfirm('reopen')}>
                <RotateCcw size={19} />
                פתח מחדש לעריכת כניסות/יציאות
              </Button>
            )}
            <Button variant="danger" block className="!justify-start" onClick={() => setConfirm('delete')}>
              <Trash2 size={19} />
              מחק משחק
            </Button>
            <Button variant="ghost" block className="!justify-start" onClick={() => navigate('/calendar')}>
              <LogOut size={19} />
              חזרה ליומן
            </Button>
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirm === 'delete'}
        title="למחוק את המשחק?"
        text="כל הכניסות, היציאות וההעברות של המשחק יימחקו לצמיתות."
        confirmLabel="מחק"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          onClose();
          await run(() => actions.deleteSession(session.id), 'המשחק נמחק');
          navigate('/calendar');
        }}
      />
      <ConfirmSheet
        open={confirm === 'reopen'}
        title="לפתוח את המשחק מחדש?"
        text="רשימת ההעברות וסימוני התשלום יימחקו ויחושבו מחדש בסגירה הבאה."
        confirmLabel="פתח מחדש"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          onClose();
          await run(() => actions.reopenSession(session.id), 'המשחק נפתח מחדש');
        }}
      />
    </>
  );
}
