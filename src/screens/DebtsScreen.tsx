import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, MessageCircle, Settings, Trophy } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Header } from '../components/Header';
import { TransferRow } from '../components/SettlementView';
import { useToast } from '../components/Toast';
import { Avatar, Card, cx, EmptyState, IconButton, Money, SectionTitle, Segmented } from '../components/ui';
import { leaderboard, openDebts } from '../lib/stats';
import { formatMoney, sumMoney } from '../lib/money';
import { daysAgoLabel, fmtDate } from '../lib/format';
import { copyText, reminderText } from '../lib/whatsapp';
import { navigate } from '../lib/router';

export function DebtsScreen() {
  const { sessions, players, meId } = useData();
  const toast = useToast();
  const [tab, setTab] = useState<'debts' | 'leaders'>('debts');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [sortBy, setSortBy] = useState<'total' | 'average'>('total');

  const debts = useMemo(() => openDebts(sessions), [sessions]);
  const shown = scope === 'mine' ? debts.filter((d) => d.from === meId || d.to === meId) : debts;
  const board = useMemo(() => {
    const rows = leaderboard(players, sessions);
    return sortBy === 'average' ? [...rows].sort((a, b) => b.average - a.average) : rows;
  }, [players, sessions, sortBy]);

  return (
    <>
      <Header
        title="חובות וטבלת מובילים"
        actions={
          <IconButton label="הגדרות" onClick={() => navigate('/settings')}>
            <Settings size={22} />
          </IconButton>
        }
      />
      <div className="px-4 pt-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'debts', label: `חובות פתוחים (${debts.length})` },
            { value: 'leaders', label: 'טבלת מובילים' },
          ]}
        />

        {tab === 'debts' && (
          <>
            <Card className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">סה״כ לא שולם</div>
                <div className="num text-right text-3xl font-extrabold text-rose-400">{formatMoney(sumMoney(shown.map((d) => d.amount)))}</div>
              </div>
              <div className="w-40">
                <Segmented
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: 'all', label: 'כולם' },
                    { value: 'mine', label: 'שלי' },
                  ]}
                />
              </div>
            </Card>

            {shown.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={30} />} title="אין חובות פתוחים" text="כולם שילמו – כל הכבוד 👏" />
            ) : (
              <div className="mt-3 space-y-2.5">
                {shown.map((d) => (
                  <TransferRow
                    key={d.id}
                    sessionId={d.sessionId}
                    transfer={d}
                    meId={meId}
                    extra={
                      <>
                        <button type="button" onClick={() => navigate(`/session/${d.sessionId}`)} className="underline-offset-2 active:underline">
                          משחק {fmtDate(d.sessionDate)}
                        </button>
                        <span className={cx(d.daysAgo > 14 ? 'text-rose-400' : d.daysAgo > 6 ? 'text-amber-400' : '')}>
                          · {daysAgoLabel(d.daysAgo)}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await copyText(reminderText(d, players));
                            toast(ok ? 'התזכורת הועתקה – שלחו בוואטסאפ 💬' : 'ההעתקה נכשלה', ok ? 'success' : 'error');
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-1 text-[#5be38f] active:bg-[#25D366]/25"
                        >
                          <MessageCircle size={12} />
                          העתק תזכורת
                        </button>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'leaders' && (
          <>
            <SectionTitle
              action={
                <div className="w-44">
                  <Segmented
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: 'total', label: 'מצטבר' },
                      { value: 'average', label: 'ממוצע' },
                    ]}
                  />
                </div>
              }
            >
              דירוג לפי {sortBy === 'total' ? 'רווח מצטבר' : 'ממוצע למשחק'}
            </SectionTitle>
            {board.length === 0 ? (
              <EmptyState icon={<Trophy size={30} />} title="עדיין אין משחקים סגורים" />
            ) : (
              <div className="space-y-2">
                {board.map((r, i) => (
                  <Card
                    key={r.player.id}
                    onClick={() => navigate(r.player.id === meId ? '/me' : `/player/${r.player.id}`)}
                    className={cx('flex items-center gap-3 !p-3', r.player.id === meId && '!border-red-500/30')}
                  >
                    <span
                      className={cx(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        i === 0 ? 'bg-amber-400 text-amber-950' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-orange-700 text-orange-50' : 'bg-slate-800 text-slate-400',
                      )}
                    >
                      {i + 1}
                    </span>
                    <Avatar name={r.player.name} id={r.player.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {r.player.name}
                        {r.player.id === meId && <span className="text-xs text-slate-500"> (אני)</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        {r.games} משחקים · <Money value={r.average} className="!font-normal" /> בממוצע · {r.winRate}% ברווח
                      </div>
                    </div>
                    <div className="text-left text-lg">
                      <Money value={sortBy === 'total' ? r.total : r.average} />
                    </div>
                    <ChevronLeft size={18} className="shrink-0 text-slate-600" />
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
