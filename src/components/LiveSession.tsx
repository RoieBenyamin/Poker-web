import { useMemo, useState } from 'react';
import { Check, Clock, Crown, DoorOpen, Lock, MoreVertical, Pencil, Plus, Trash2, UserPlus, Wallet, X } from 'lucide-react';
import type { Session } from '../types';
import { useData } from '../data/DataContext';
import { useRun } from './Toast';
import { Header } from './Header';
import { ShareSessionButton } from './ShareSession';
import { SessionMenuSheet } from './SessionMenuSheet';
import { CloseSessionSheet } from './CloseSessionSheet';
import { PlayerPicker } from './PlayerPicker';
import { Avatar, Button, Card, ConfirmSheet, cx, EmptyState, IconButton, inputCls, Money, MoneyInput, SectionTitle, Sheet } from './ui';
import { playerLines, sessionTotals, type PlayerLine } from '../lib/settlement';
import { formatMoney, parseAmount } from '../lib/money';
import { fmtLongDate, fmtTime } from '../lib/format';

export function LiveSession({ session, back }: { session: Session; back?: () => void }) {
  const { getPlayer, actions, meId, isGroupAdmin, activeGroup } = useData();
  const run = useRun();
  const totals = sessionTotals(session);
  const lines = useMemo(() => {
    const l = playerLines(session);
    // me first, then players still playing, then cashed-out
    return l.sort((a, b) => {
      if (a.playerId === meId) return -1;
      if (b.playerId === meId) return 1;
      return Number(a.cashOut != null) - Number(b.cashOut != null);
    });
  }, [session, meId]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [cashOutId, setCashOutId] = useState<string | null>(null);
  const [customId, setCustomId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const nameOf = (id: string) => getPlayer(id)?.name ?? 'שחקן';
  const stillPlaying = totals.playerCount - totals.cashedOutCount;

  const quickBuyIn = (playerId: string) =>
    run(
      () => actions.addBuyIn(session.id, playerId, session.buyInAmount),
      `נרשמה כניסה של ${formatMoney(session.buyInAmount)} ל${nameOf(playerId)}`,
    );

  return (
    <>
      <Header
        title="שולחן פעיל"
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
        {/* Live pot summary */}
        <div className="relative overflow-hidden rounded-[2rem] border border-red-500/30 bg-gradient-to-br from-red-950/90 via-red-950/45 to-slate-900 p-5 shadow-2xl shadow-red-950/30">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-red-400/10 blur-2xl" />
          <div className="flex items-center gap-2 text-sm text-red-200/80">
            <span className="live-dot h-2.5 w-2.5 rounded-full bg-emerald-400" />
            קופה חיה
          </div>
          <div className="num mt-1 text-right text-5xl font-extrabold tracking-tight text-white">{formatMoney(totals.totalIn)}</div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="שחקנים" value={String(totals.playerCount)} />
            <Stat label="עדיין משחקים" value={String(stillPlaying)} />
            <Stat label="כבר יצאו עם" value={formatMoney(totals.totalOut)} />
          </div>
          <div className="mt-3 text-center text-xs text-red-200/60">
            כניסה סטנדרטית: <span className="num">{formatMoney(session.buyInAmount)}</span>
            {session.note && <> · {session.note}</>}
          </div>
        </div>

        <SectionTitle
          action={
            (isGroupAdmin || !session.players.some((p) => p.playerId === meId)) && (
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus size={17} />
              {isGroupAdmin ? 'הוסף שחקן' : 'הצטרף לשולחן'}
            </Button>
            )
          }
        >
          שחקנים בשולחן
        </SectionTitle>

        {lines.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={30} />}
            title="השולחן ריק"
            text="הוסיפו שחקנים כדי להתחיל לרשום כניסות"
            action={
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus size={18} />
                הוסף שחקנים
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {lines.map((l) => (
              <PlayerRow
                key={l.playerId}
                line={l}
                name={nameOf(l.playerId)}
                isMe={l.playerId === meId}
                canManage={isGroupAdmin || l.playerId === meId}
                isAdmin={activeGroup?.members.some((m) => m.playerId === l.playerId && m.role === 'admin') ?? false}
                buyInAmount={session.buyInAmount}
                onOpen={() => setDetailId(l.playerId)}
                onQuick={() => quickBuyIn(l.playerId)}
                onCustom={() => setCustomId(l.playerId)}
                onCashOut={() => setCashOutId(l.playerId)}
              />
            ))}
          </div>
        )}

        {isGroupAdmin && lines.length > 0 && (
          <Button size="lg" block variant={totals.allCashedOut ? 'primary' : 'secondary'} className="mt-6" onClick={() => setCloseOpen(true)}>
            <Lock size={20} />
            סגור משחק וחשב העברות
          </Button>
        )}
        {!totals.allCashedOut && lines.length > 0 && (
          <p className="mt-2 text-center text-xs text-slate-500">לפני הסגירה כל שחקן צריך להזין עם כמה יצא</p>
        )}
      </div>

      {/* Sheets */}
      {detailId && (
        <PlayerLogSheet
          session={session}
          playerId={detailId}
          name={nameOf(detailId)}
          isAdmin={isGroupAdmin}
          canManage={isGroupAdmin || detailId === meId}
          onClose={() => setDetailId(null)}
          onCashOut={() => {
            setCashOutId(detailId);
            setDetailId(null);
          }}
        />
      )}
      {customId && (
        <CustomBuyInSheet
          name={nameOf(customId)}
          defaultAmount={session.buyInAmount}
          onClose={() => setCustomId(null)}
          onSubmit={async (amount) => {
            const id = customId;
            setCustomId(null);
            await run(() => actions.addBuyIn(session.id, id, amount), `נרשמה כניסה של ${formatMoney(amount)} ל${nameOf(id)}`);
          }}
        />
      )}
      {cashOutId && (
        <CashOutSheet
          line={lines.find((l) => l.playerId === cashOutId)!}
          name={nameOf(cashOutId)}
          onClose={() => setCashOutId(null)}
          onSubmit={async (amount) => {
            const id = cashOutId;
            setCashOutId(null);
            await run(
              () => actions.setCashOut(session.id, id, amount),
              amount == null ? `${nameOf(id)} חזר לשחק` : `נרשמה יציאה של ${formatMoney(amount)} ל${nameOf(id)}`,
            );
          }}
        />
      )}
      {addOpen && <AddPlayersSheet session={session} onClose={() => setAddOpen(false)} />}
      {menuOpen && <SessionMenuSheet session={session} open onClose={() => setMenuOpen(false)} />}
      {closeOpen && (
        <CloseSessionSheet
          session={session}
          onClose={() => setCloseOpen(false)}
          onFixPlayer={(id) => {
            setCloseOpen(false);
            setCashOutId(id);
          }}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 px-2 py-2">
      <div className="num text-lg font-bold text-white">{value}</div>
      <div className="text-[11px] text-slate-300">{label}</div>
    </div>
  );
}

function PlayerRow({
  line,
  name,
  isMe,
  canManage,
  isAdmin,
  buyInAmount,
  onOpen,
  onQuick,
  onCustom,
  onCashOut,
}: {
  line: PlayerLine;
  name: string;
  isMe: boolean;
  canManage: boolean;
  isAdmin: boolean;
  buyInAmount: number;
  onOpen: () => void;
  onQuick: () => void;
  onCustom: () => void;
  onCashOut: () => void;
}) {
  const out = line.cashOut != null;
  return (
    <Card className={cx('!p-3', isMe && '!border-red-500/30', out && 'opacity-80')}>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-right">
        <Avatar name={name} id={line.playerId} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold">{name}</span>
            {isAdmin && <Crown size={13} className="shrink-0 text-amber-300" />}
            {isMe && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-300">אני</span>}
            {out && <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-[11px] text-slate-300">יצא</span>}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock size={12} />
            {line.buyInCount} כניסות · לחץ לפירוט
          </div>
        </div>
        <div className="text-left">
          <div className="num text-xl font-bold">{formatMoney(line.buyIn)}</div>
          {out ? (
            <div className="text-xs text-slate-400">
              יצא <span className="num">{formatMoney(line.cashOut!)}</span> · <Money value={line.net!} />
            </div>
          ) : (
            <div className="text-xs text-slate-500">סך כניסות</div>
          )}
        </div>
      </button>
      {canManage && <div className="mt-3 flex gap-2">
        <Button className="flex-[2]" onClick={onQuick}>
          <Plus size={20} strokeWidth={2.8} />
          כניסה <span className="num">{formatMoney(buyInAmount)}</span>
        </Button>
        <Button variant="secondary" className="flex-1 !px-2" onClick={onCustom} aria-label="כניסה בסכום אחר">
          <Wallet size={18} />
          סכום
        </Button>
        <Button variant={out ? 'secondary' : 'outline'} className="flex-1 !px-2" onClick={onCashOut}>
          <DoorOpen size={18} />
          {out ? 'עדכן' : 'יציאה'}
        </Button>
      </div>}
    </Card>
  );
}

function CustomBuyInSheet({
  name,
  defaultAmount,
  onClose,
  onSubmit,
}: {
  name: string;
  defaultAmount: number;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  const [value, setValue] = useState('');
  const parsed = parseAmount(value);
  const ok = parsed !== null && parsed > 0;
  const submit = () => ok && onSubmit(parsed!);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`כניסה בסכום מותאם – ${name}`}
      footer={
        <Button block size="lg" onClick={submit} disabled={!ok}>
          <Plus size={20} />
          הוסף כניסה {ok && <span className="num">{formatMoney(parsed!)}</span>}
        </Button>
      }
    >
      <div className="mb-3 flex gap-2">
        {[defaultAmount / 2, defaultAmount * 2, defaultAmount * 3].filter((v) => v > 0).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setValue(String(v))}
            className="num h-11 flex-1 rounded-xl border border-slate-700 font-semibold text-slate-300 active:bg-slate-800"
          >
            {formatMoney(v)}
          </button>
        ))}
      </div>
      <MoneyInput value={value} onChange={setValue} autoFocus onEnter={submit} placeholder="הזן סכום" />
    </Sheet>
  );
}

function CashOutSheet({
  line,
  name,
  onClose,
  onSubmit,
}: {
  line: PlayerLine;
  name: string;
  onClose: () => void;
  onSubmit: (amount: number | null) => void;
}) {
  const [value, setValue] = useState(line.cashOut != null ? String(line.cashOut) : '');
  const parsed = parseAmount(value);
  const net = parsed != null ? parsed - line.buyIn : null;
  const submit = () => parsed !== null && onSubmit(parsed);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`יציאה – ${name}`}
      footer={
        <div className="space-y-2">
          <Button block size="lg" onClick={submit} disabled={parsed === null}>
            <Check size={20} />
            שמור יציאה
          </Button>
          {line.cashOut != null && (
            <Button variant="ghost" block onClick={() => onSubmit(null)}>
              ביטול יציאה – השחקן חוזר לשחק
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
          <div className="text-xs text-slate-400">סך כניסות</div>
          <div className="num text-xl font-bold">{formatMoney(line.buyIn)}</div>
        </div>
        <div className="rounded-2xl bg-slate-950/50 p-3 text-center">
          <div className="text-xs text-slate-400">רווח / הפסד</div>
          <div className="text-xl">{net == null ? <span className="text-slate-500">—</span> : <Money value={net} />}</div>
        </div>
      </div>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">עם כמה צ'יפים (₪) יצא?</label>
      <MoneyInput value={value} onChange={setValue} autoFocus onEnter={submit} placeholder="0 – אם הפסיד הכל" />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setValue('0')}>
          הפסיד הכל (0₪)
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => setValue(String(line.buyIn))}>
          יצא באיזון
        </Button>
      </div>
    </Sheet>
  );
}

function PlayerLogSheet({
  session,
  playerId,
  name,
  isAdmin,
  canManage,
  onClose,
  onCashOut,
}: {
  session: Session;
  playerId: string;
  name: string;
  isAdmin: boolean;
  canManage: boolean;
  onClose: () => void;
  onCashOut: () => void;
}) {
  const { actions } = useData();
  const run = useRun();
  const entries = session.buyIns.filter((b) => b.playerId === playerId).sort((a, b) => a.at.localeCompare(b.at));
  const sp = session.players.find((p) => p.playerId === playerId);
  const total = entries.reduce((a, b) => a + b.amount, 0);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editTime, setEditTime] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const startEdit = (id: string) => {
    const e = entries.find((x) => x.id === id)!;
    setEditId(id);
    setEditAmount(String(e.amount));
    const d = new Date(e.at);
    setEditTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  const saveEdit = async () => {
    const amount = parseAmount(editAmount);
    if (!editId || amount === null || amount <= 0) return;
    const entry = entries.find((x) => x.id === editId)!;
    const d = new Date(entry.at);
    const [h, m] = editTime.split(':').map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) d.setHours(h, m);
    await run(() => actions.updateBuyIn(session.id, editId, { amount, at: d.toISOString() }), 'הכניסה עודכנה');
    setEditId(null);
  };

  if (!sp) return null;

  return (
    <>
      <Sheet
        open={!confirmDelete && !confirmRemove}
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <Avatar name={name} id={playerId} size="sm" />
            {name}
          </span>
        }
        footer={
          canManage && (
          <div className="flex gap-2">
            <Button variant="outline" block onClick={onCashOut}>
              <DoorOpen size={18} />
              {sp.cashOut != null ? 'עדכון יציאה' : 'הזנת יציאה'}
            </Button>
            {isAdmin && <Button variant="danger" onClick={() => setConfirmRemove(true)} aria-label="הסר מהשולחן">
              <Trash2 size={18} />
            </Button>}
          </div>
          )
        }
      >
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-slate-950/50 p-3">
          <span className="text-sm text-slate-400">סך הכל {entries.length} כניסות</span>
          <span className="num text-xl font-bold">{formatMoney(total)}</span>
        </div>
        <h4 className="mb-2 text-sm font-semibold text-slate-400">לוג כניסות</h4>
        {entries.length === 0 && <p className="py-4 text-center text-sm text-slate-500">עדיין אין כניסות</p>}
        <ol className="space-y-2">
          {entries.map((e, i) => (
            <li key={e.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
              {editId === e.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <MoneyInput value={editAmount} onChange={setEditAmount} autoFocus onEnter={saveEdit} />
                    </div>
                    <input type="time" className={cx(inputCls, '!w-32')} value={editTime} onChange={(ev) => setEditTime(ev.target.value)} dir="ltr" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={saveEdit}>
                      <Check size={16} /> שמור
                    </Button>
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditId(null)}>
                      <X size={16} /> ביטול
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-slate-300">{i + 1}</span>
                  <div className="flex-1">
                    <div className="num text-right text-lg font-semibold">{formatMoney(e.amount)}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={12} />
                      {i === 0 ? 'כניסה ראשונה' : 'ריבאי'} בשעה <span className="num">{fmtTime(e.at)}</span>
                    </div>
                  </div>
                  {isAdmin && <>
                    <IconButton label="ערוך" onClick={() => startEdit(e.id)}>
                      <Pencil size={18} />
                    </IconButton>
                    <IconButton label="מחק" onClick={() => setConfirmDelete(e.id)} className="text-rose-400">
                      <Trash2 size={18} />
                    </IconButton>
                  </>}
                </div>
              )}
            </li>
          ))}
        </ol>
        {sp.cashOut != null && (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
            <span className="flex items-center gap-1.5 text-sm text-slate-300">
              <DoorOpen size={16} /> יצא{sp.cashOutAt ? <> בשעה <span className="num">{fmtTime(sp.cashOutAt)}</span></> : null}
            </span>
            <span className="num font-bold">{formatMoney(sp.cashOut)}</span>
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!confirmDelete}
        title="למחוק את הכניסה?"
        text="הכניסה תוסר מהלוג וסך הכניסות יתעדכן."
        confirmLabel="מחק כניסה"
        danger
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && run(() => actions.deleteBuyIn(session.id, confirmDelete), 'הכניסה נמחקה')}
      />
      <ConfirmSheet
        open={confirmRemove}
        title={`להסיר את ${name} מהשולחן?`}
        text="כל הכניסות והיציאה של השחקן במשחק הזה יימחקו."
        confirmLabel="הסר"
        danger
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          onClose();
          run(() => actions.removePlayerFromSession(session.id, playerId), `${name} הוסר מהשולחן`);
        }}
      />
    </>
  );
}

function AddPlayersSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const { actions, getPlayer, isGroupAdmin, meId } = useData();
  const run = useRun();
  const [withBuyIn, setWithBuyIn] = useState(true);
  const present = session.players.map((p) => p.playerId);

  const add = (id: string) =>
    run(() => actions.addPlayerToSession(session.id, id, withBuyIn), `${getPlayer(id)?.name ?? 'השחקן'} הצטרף לשולחן`);

  return (
    <Sheet open onClose={onClose} title="הוספת שחקנים לשולחן" footer={<Button block onClick={onClose}>סיום</Button>}>
      <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
        <input type="checkbox" checked={withBuyIn} onChange={(e) => setWithBuyIn(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
        <span className="text-sm text-slate-300">
          לרשום כניסה ראשונה של <span className="num">{formatMoney(session.buyInAmount)}</span> בהצטרפות
        </span>
      </label>
      <PlayerPicker selected={[]} exclude={present} allowedIds={isGroupAdmin ? undefined : meId ? [meId] : []} onToggle={add} />
    </Sheet>
  );
}
