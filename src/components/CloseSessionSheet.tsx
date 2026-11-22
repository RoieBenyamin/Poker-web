import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Wrench } from 'lucide-react';
import type { Session } from '../types';
import { useData } from '../data/DataContext';
import { useRun } from './Toast';
import { Avatar, Button, cx, Money, Sheet } from './ui';
import { playerLines, sessionTotals, settleSession } from '../lib/settlement';
import { formatMoney } from '../lib/money';

/** Balance check + transfers preview before locking a game. */
export function CloseSessionSheet({
  session,
  onClose,
  onFixPlayer,
}: {
  session: Session;
  onClose: () => void;
  onFixPlayer: (playerId: string) => void;
}) {
  const { getPlayer, actions } = useData();
  const run = useRun();
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const totals = sessionTotals(session);
  const missing = playerLines(session).filter((l) => l.cashOut == null);
  const balanced = totals.diff === 0;
  const name = (id: string) => getPlayer(id)?.name ?? 'שחקן';

  const preview = useMemo(() => (totals.allCashedOut ? settleSession(session) : null), [session, totals.allCashedOut]);
  const canClose = totals.allCashedOut && (balanced || approved);

  const close = async () => {
    setBusy(true);
    const ok = await run(() => actions.closeSession(session.id).then(() => true), 'המשחק ננעל – ההעברות חושבו ✓');
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="סגירת משחק ואיזון קופה"
      footer={
        <Button block size="lg" disabled={!canClose || busy} onClick={close}>
          <Lock size={20} />
          נעל משחק וחשב העברות
        </Button>
      }
    >
      {/* Step 1 – everyone cashed out */}
      {missing.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle size={18} />
            חסרה יציאה ל-{missing.length} שחקנים
          </div>
          <div className="mt-3 space-y-2">
            {missing.map((l) => (
              <button
                key={l.playerId}
                type="button"
                onClick={() => onFixPlayer(l.playerId)}
                className="flex h-12 w-full items-center gap-3 rounded-xl bg-slate-900/70 px-3 text-right active:bg-slate-800"
              >
                <Avatar name={name(l.playerId)} id={l.playerId} size="sm" />
                <span className="flex-1 font-medium">{name(l.playerId)}</span>
                <span className="text-sm text-amber-300">הזן יציאה</span>
                <ArrowLeft size={16} className="text-amber-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 – balance check */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
          <div className="text-xs text-slate-400">סך כניסות</div>
          <div className="num text-2xl font-bold">{formatMoney(totals.totalIn)}</div>
        </div>
        <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
          <div className="text-xs text-slate-400">סך יציאות</div>
          <div className="num text-2xl font-bold">{formatMoney(totals.totalOut)}</div>
        </div>
      </div>

      {totals.allCashedOut && balanced && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 font-semibold text-emerald-300">
          <CheckCircle2 size={20} />
          הקופה מאוזנת – אפשר לסגור
        </div>
      )}

      {totals.allCashedOut && !balanced && (
        <div className="mt-3 rounded-2xl border-2 border-rose-500/60 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 text-lg font-bold text-rose-300">
            <AlertTriangle size={22} />
            הקופה לא מאוזנת!
          </div>
          <p className="mt-1 text-sm text-rose-100/80">
            {totals.diff > 0 ? 'היציאות גבוהות מהכניסות' : 'היציאות נמוכות מהכניסות'} בהפרש של{' '}
            <span className="num text-lg font-extrabold text-white">{formatMoney(totals.diff)}</span>
          </p>
          <p className="mt-2 text-xs text-slate-400">
            אם תאשרו בכל זאת, ההפרש יחולק באופן יחסי בין {totals.diff > 0 ? 'המרוויחים' : 'המפסידים'} כדי שההעברות יתאזנו.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>
              <Wrench size={16} />
              חזור לתיקון
            </Button>
            <Button
              size="sm"
              variant={approved ? 'primary' : 'danger'}
              className="flex-1"
              onClick={() => setApproved((v) => !v)}
            >
              {approved ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {approved ? 'אושר' : 'אשר בכל זאת'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 – preview */}
      {preview && (
        <>
          <h4 className="mb-2 mt-5 text-sm font-semibold text-slate-400">תוצאות</h4>
          <div className="space-y-1.5">
            {Object.entries(preview.results)
              .sort((a, b) => b[1] - a[1])
              .map(([id, net]) => (
                <div key={id} className="flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2">
                  <span>{name(id)}</span>
                  <Money value={net} />
                </div>
              ))}
          </div>
          <h4 className="mb-2 mt-5 text-sm font-semibold text-slate-400">
            העברות נדרשות ({preview.transfers.length}) – מינימום העברות
          </h4>
          {preview.transfers.length === 0 && <p className="text-sm text-slate-500">אין צורך בהעברות 🎉</p>}
          <div className={cx('space-y-1.5', !canClose && 'opacity-60')}>
            {preview.transfers.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-xl bg-slate-950/40 px-3 py-2.5 text-sm">
                <span className="font-semibold text-rose-300">{name(t.from)}</span>
                <span className="text-slate-500">⬅️ מעביר</span>
                <span className="num font-bold">{formatMoney(t.amount)}</span>
                <span className="text-slate-500">ל-</span>
                <span className="font-semibold text-emerald-300">{name(t.to)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
