import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, MessageCircle, MoreVertical, Phone } from 'lucide-react';
import type { Session, Transfer } from '../types';
import { useData } from '../data/DataContext';
import { useRun, useToast } from './Toast';
import { Header } from './Header';
import { ShareSessionButton } from './ShareSession';
import { SessionMenuSheet } from './SessionMenuSheet';
import { Avatar, Button, Card, cx, IconButton, Money, SectionTitle, StatusBadge } from './ui';
import { playerLines, sessionTotals } from '../lib/settlement';
import { sessionStatus } from '../lib/stats';
import { formatMoney } from '../lib/money';
import { fmtDateTime, fmtLongDate, fmtTime } from '../lib/format';
import { copyText, sessionSummaryText, whatsappUrl } from '../lib/whatsapp';

/** Closed game: results, minimal transfers with "paid" tracking and WhatsApp summary. */
export function SettlementView({ session, back }: { session: Session; back?: () => void }) {
  const { players, getPlayer, meId, isGroupAdmin } = useData();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const totals = sessionTotals(session);
  const status = sessionStatus(session);
  const paidCount = session.transfers.filter((t) => t.paid).length;
  const lines = playerLines(session)
    .map((l) => ({ ...l, final: session.results?.[l.playerId] ?? l.net ?? 0 }))
    .sort((a, b) => b.final - a.final);
  const name = (id: string) => getPlayer(id)?.name ?? 'שחקן';

  const copySummary = async () => {
    const ok = await copyText(sessionSummaryText(session, players));
    toast(ok ? 'הסיכום הועתק – הדביקו בקבוצה 📋' : 'ההעתקה נכשלה', ok ? 'success' : 'error');
  };

  return (
    <>
      <Header
        title="סיכום משחק"
        subtitle={`${fmtLongDate(session.date)} · ${fmtTime(session.date)}${session.location ? ` · ${session.location}` : ''}`}
        back={back}
        actions={
          <>
            <ShareSessionButton session={session} />
            {isGroupAdmin && (
              <IconButton label="אפשרויות" onClick={() => setMenuOpen(true)}>
                <MoreVertical size={22} />
              </IconButton>
            )}
          </>
        }
      />
      <div className="px-4 pt-4">
        <Card>
          <div className="flex items-center justify-between">
            <StatusBadge status={status} />
            {session.closedAt && <span className="text-xs text-slate-500">ננעל {fmtDateTime(session.closedAt)}</span>}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-slate-950/50 p-2.5">
              <div className="num text-lg font-bold">{formatMoney(totals.totalIn)}</div>
              <div className="text-[11px] text-slate-400">קופה</div>
            </div>
            <div className="rounded-2xl bg-slate-950/50 p-2.5">
              <div className="num text-lg font-bold">{totals.playerCount}</div>
              <div className="text-[11px] text-slate-400">שחקנים</div>
            </div>
            <div className="rounded-2xl bg-slate-950/50 p-2.5">
              <div className="num text-lg font-bold">
                {paidCount}/{session.transfers.length}
              </div>
              <div className="text-[11px] text-slate-400">העברות שולמו</div>
            </div>
          </div>
          {session.transfers.length > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(paidCount / session.transfers.length) * 100}%` }}
              />
            </div>
          )}
          {!!session.approvedDiff && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                אושר הפרש קופה של <span className="num font-bold">{formatMoney(session.approvedDiff)}</span> – חולק באופן יחסי.
              </span>
            </div>
          )}
        </Card>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={copySummary}>
            <Copy size={18} />
            העתק סיכום לוואטסאפ
          </Button>
          <a
            href={whatsappUrl(sessionSummaryText(session, players))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366]/15 font-semibold text-[#5be38f] border border-[#25D366]/40 active:bg-[#25D366]/25"
          >
            <MessageCircle size={18} />
            שלח בוואטסאפ
          </a>
        </div>

        <SectionTitle>העברות ({session.transfers.length})</SectionTitle>
        {session.transfers.length === 0 ? (
          <Card className="text-center text-slate-400">אין צורך בהעברות – כולם יצאו מאוזנים 🎉</Card>
        ) : (
          <div className="space-y-2.5">
            {session.transfers.map((t) => (
              <TransferRow key={t.id} sessionId={session.id} transfer={t} meId={meId} />
            ))}
          </div>
        )}

        <SectionTitle>מאזן שחקנים</SectionTitle>
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/50 text-xs text-slate-400">
              <tr>
                <th className="px-3 py-2.5 text-right font-medium">שחקן</th>
                <th className="px-2 py-2.5 text-center font-medium">נכנס</th>
                <th className="px-2 py-2.5 text-center font-medium">יצא</th>
                <th className="px-3 py-2.5 text-left font-medium">נטו</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.playerId} className={cx('border-t border-slate-800/70', l.playerId === meId && 'bg-emerald-500/5')}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={name(l.playerId)} id={l.playerId} photoURL={getPlayer(l.playerId)?.photoURL} size="sm" />
                      <span className="font-medium">
                        {name(l.playerId)}
                        {i === 0 && l.final > 0 && ' 🏆'}
                      </span>
                    </div>
                  </td>
                  <td className="num px-2 py-3 text-center text-slate-300">
                    {formatMoney(l.buyIn)}
                    <div className="text-[10px] text-slate-500">×{l.buyInCount}</div>
                  </td>
                  <td className="num px-2 py-3 text-center text-slate-300">{formatMoney(l.cashOut ?? 0)}</td>
                  <td className="px-3 py-3 text-left">
                    <Money value={l.final} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      {menuOpen && <SessionMenuSheet session={session} open onClose={() => setMenuOpen(false)} />}
    </>
  );
}

export function TransferRow({
  sessionId,
  transfer: t,
  meId,
  extra,
}: {
  sessionId: string;
  transfer: Transfer;
  meId: string | null;
  extra?: ReactNode;
}) {
  const { getPlayer, actions, isGroupAdmin } = useData();
  const run = useRun();
  const toast = useToast();
  const from = getPlayer(t.from);
  const to = getPlayer(t.to);
  const involved = t.from === meId || t.to === meId;

  return (
    <Card className={cx('!p-3', t.paid && 'opacity-60', involved && !t.paid && '!border-amber-500/30')}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-base">
            <span className={cx('font-semibold', t.from === meId ? 'text-amber-300' : 'text-rose-300')}>
              {t.from === meId ? 'אני' : from?.name ?? 'שחקן'}
            </span>
            <span className="text-slate-500">⬅️ מעביר</span>
            <span className="num font-extrabold">{formatMoney(t.amount)}</span>
            <span className="text-slate-500">ל-</span>
            <span className={cx('font-semibold', t.to === meId ? 'text-amber-300' : 'text-emerald-300')}>
              {t.to === meId ? 'לי' : to?.name ?? 'שחקן'}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {t.paid && t.paidAt ? <span>שולם ב-{fmtDateTime(t.paidAt)}</span> : extra}
            {!t.paid && to?.phone && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(to.phone!.replace(/[^\d+]/g, ''));
                  toast(ok ? `המספר של ${to.name} הועתק – לביט / פייבוקס` : 'ההעתקה נכשלה', ok ? 'success' : 'error');
                }}
                className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-slate-300 active:bg-slate-700"
              >
                <Phone size={12} />
                <span className="num">{to.phone}</span>
              </button>
            )}
          </div>
        </div>
        {(t.from === meId || isGroupAdmin) && <button
          type="button"
          onClick={() => run(() => actions.setTransferPaid(sessionId, t.id, !t.paid), t.paid ? 'סומן כלא שולם' : 'סומן כשולם ✓')}
          className={cx(
            'flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-sm font-semibold transition-colors',
            t.paid
              ? 'border-emerald-500 bg-emerald-500 text-emerald-950'
              : 'border-slate-600 text-slate-300 active:bg-slate-800',
          )}
          aria-pressed={t.paid}
        >
          <span className={cx('flex h-5 w-5 items-center justify-center rounded-md border', t.paid ? 'border-emerald-950' : 'border-slate-500')}>
            {t.paid && <Check size={14} strokeWidth={3.5} />}
          </span>
          שולם
        </button>}
      </div>
    </Card>
  );
}
