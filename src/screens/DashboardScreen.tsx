import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Hash, Settings, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Header } from '../components/Header';
import { TrendChart } from '../components/TrendChart';
import { TransferRow } from '../components/SettlementView';
import { Avatar, Button, Card, cx, EmptyState, IconButton, inputCls, Money, SectionTitle, Segmented } from '../components/ui';
import { playerDebtSummary, playerResults, recentSummary, type RangeOption } from '../lib/stats';
import { formatMoney, formatSigned, ltr, moneyTone } from '../lib/money';
import { daysAgoLabel, fmtDate } from '../lib/format';
import { navigate } from '../lib/router';

const PRESETS: Array<{ value: RangeOption; label: string }> = [
  { value: 3, label: '3 אחרונים' },
  { value: 5, label: '5 אחרונים' },
  { value: 10, label: '10 אחרונים' },
  { value: 'all', label: 'הכל' },
];

export function DashboardScreen({ playerId }: { playerId?: string }) {
  const { getPlayer, sessions, allSessions, meId } = useData();
  const player = playerId ? getPlayer(playerId) : undefined;
  const isMe = player?.id === meId;

  const [range, setRange] = useState<RangeOption>(5);
  const [scope, setScope] = useState<'group' | 'all'>('group');
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const statsSessions = scope === 'all' ? allSessions : sessions;
  const results = useMemo(() => (player ? playerResults(statsSessions, player.id) : []), [statsSessions, player]);
  const summary = useMemo(() => recentSummary(results, range), [results, range]);
  const overall = useMemo(() => recentSummary(results, 'all'), [results]);
  const debts = useMemo(() => (player ? playerDebtSummary(statsSessions, player.id) : null), [statsSessions, player]);

  if (!player || !debts)
    return (
      <>
        <Header title="שחקן" back={() => history.back()} />
        <EmptyState icon={<Hash size={30} />} title="השחקן לא נמצא" />
      </>
    );

  const isPreset = PRESETS.some((p) => p.value === range) && !customOpen;
  const applyCustom = (v: string) => {
    setCustomValue(v.replace(/\D/g, ''));
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n > 0) setRange(n);
  };
  const rangeLabel = range === 'all' ? 'בכל המשחקים' : `ב-${summary.count} המשחקים האחרונים`;

  return (
    <>
      <Header
        title={isMe ? 'האזור האישי שלי' : player.name}
        subtitle={isMe ? player.name : 'פרופיל שחקן'}
        back={isMe ? undefined : () => history.back()}
        actions={
          isMe && (
            <IconButton label="הגדרות" onClick={() => navigate('/settings')}>
              <Settings size={22} />
            </IconButton>
          )
        }
      />

      <div className="px-4 pt-4">
        {isMe && (
          <div className="mb-3">
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: 'group', label: 'הקבוצה הנוכחית' },
                { value: 'all', label: 'כל הקבוצות' },
              ]}
            />
          </div>
        )}
        {results.length === 0 ? (
          <Card>
            <EmptyState icon={<Trophy size={30} />} title="עדיין אין משחקים סגורים" text="אחרי המשחק הראשון יופיעו כאן הממוצעים, הגרף וההיסטוריה." />
          </Card>
        ) : (
          <>
            {/* Recent average hero */}
            <div
              className={cx(
                'relative overflow-hidden rounded-[2rem] border p-5 shadow-2xl',
                summary.average >= 0
                  ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-800/50 via-slate-900 to-slate-900 shadow-emerald-900/20'
                  : 'border-rose-500/30 bg-gradient-to-br from-rose-900/40 via-slate-900 to-slate-900 shadow-rose-900/20',
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar name={player.name} id={player.id} size="lg" />
                <div>
                  <div className="text-sm text-slate-300">ממוצע רווח/הפסד</div>
                  <div className="text-xs text-slate-400">{rangeLabel}</div>
                </div>
                <div className={cx('mr-auto flex h-11 w-11 items-center justify-center rounded-2xl', summary.average >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
                  {summary.average >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={cx('num text-5xl font-extrabold tracking-tight', moneyTone(summary.average))}>{ltr(formatSigned(summary.average))}</span>
                <span className="text-base text-slate-300">בממוצע למשחק</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="סך מצטבר" value={<Money value={summary.total} />} />
                <MiniStat label="ניצחונות" value={<span className="num font-semibold">{summary.wins}/{summary.count}</span>} />
                <MiniStat label="אחוז רווח" value={<span className="num font-semibold">{summary.winRate}%</span>} />
              </div>
            </div>

            {/* Range selector */}
            <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-950/60 p-1">
              {PRESETS.map((p) => (
                <button
                  key={String(p.value)}
                  type="button"
                  onClick={() => {
                    setCustomOpen(false);
                    setRange(p.value);
                  }}
                  className={cx(
                    'h-10 flex-1 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold transition-colors',
                    isPreset && range === p.value ? 'bg-red-600 text-white' : 'text-slate-400',
                  )}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomOpen(true)}
                className={cx(
                  'h-10 flex-1 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold transition-colors',
                  !isPreset ? 'bg-red-600 text-white' : 'text-slate-400',
                )}
              >
                מותאם
              </button>
            </div>
            {customOpen && (
              <div className="mt-2 flex items-center gap-2">
                <span className="shrink-0 text-sm text-slate-400">מספר משחקים אחרונים:</span>
                <input
                  className={cx(inputCls, 'num !h-11 text-center')}
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  placeholder={String(results.length)}
                  value={customValue}
                  onChange={(e) => applyCustom(e.target.value)}
                />
                <span className="shrink-0 text-xs text-slate-500">מתוך {results.length}</span>
              </div>
            )}

            {/* Trend chart */}
            <Card className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">מגמה</h3>
                <div className="flex gap-3 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />רווח</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" />הפסד</span>
                  <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 bg-sky-400" />מצטבר</span>
                </div>
              </div>
              <TrendChart games={summary.games} />
            </Card>

            {/* All-time metrics */}
            <SectionTitle>מאז ומעולם</SectionTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <Card className="!p-3.5">
                <div className="text-xs text-slate-400">מאזן נטו כולל</div>
                <div className="mt-1 text-2xl"><Money value={overall.total} /></div>
                <div className="text-xs text-slate-500">{overall.count} משחקים</div>
              </Card>
              <Card className="!p-3.5">
                <div className="text-xs text-slate-400">אחוז משחקים ברווח</div>
                <div className="num mt-1 text-2xl font-semibold">{overall.winRate}%</div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${overall.winRate}%` }} />
                </div>
              </Card>
              <Card className="!p-3.5">
                <div className="text-xs text-slate-400">הערב הכי טוב</div>
                <div className="mt-1 text-xl"><Money value={overall.best} /></div>
              </Card>
              <Card className="!p-3.5">
                <div className="text-xs text-slate-400">הערב הכי קשה</div>
                <div className="mt-1 text-xl"><Money value={overall.worst} /></div>
              </Card>
            </div>
          </>
        )}

        {/* Debts */}
        <SectionTitle
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/debts')}>
              כל החובות
              <ChevronLeft size={16} />
            </Button>
          }
        >
          מצב חובות {isMe ? 'אישי' : ''}
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <Card className="!border-emerald-500/25 !p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-emerald-300/80">
              <ArrowDownLeft size={15} />
              {isMe ? 'חייבים לי' : `חייבים ל${player.name}`}
            </div>
            <div className="num mt-1 text-right text-2xl font-bold text-emerald-400">{formatMoney(debts.owedToMeTotal)}</div>
            <div className="text-xs text-slate-500">{debts.owedToMe.length} העברות פתוחות</div>
          </Card>
          <Card className="!border-rose-500/25 !p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-rose-300/80">
              <ArrowUpRight size={15} />
              {isMe ? 'אני חייב' : `${player.name} חייב`}
            </div>
            <div className="num mt-1 text-right text-2xl font-bold text-rose-400">{formatMoney(debts.iOweTotal)}</div>
            <div className="text-xs text-slate-500">{debts.iOwe.length} העברות פתוחות</div>
          </Card>
        </div>
        {(debts.iOwe.length > 0 || debts.owedToMe.length > 0) && (
          <div className="mt-2.5 space-y-2">
            {[...debts.iOwe, ...debts.owedToMe].map((d) => (
              <TransferRow
                key={d.id}
                sessionId={d.sessionId}
                transfer={d}
                meId={meId}
                extra={<span>משחק {fmtDate(d.sessionDate)} · {daysAgoLabel(d.daysAgo)}</span>}
              />
            ))}
          </div>
        )}

        {/* History */}
        {results.length > 0 && (
          <>
            <SectionTitle>היסטוריית המשחקים {isMe ? 'שלי' : ''}</SectionTitle>
            <Card className="!p-0 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-400">
                <span>תאריך</span>
                <span className="w-16 text-center">כניסות</span>
                <span className="w-16 text-center">יציאה</span>
                <span className="w-16 text-left">נטו</span>
              </div>
              {results.map((g) => (
                <button
                  key={g.sessionId}
                  type="button"
                  onClick={() => navigate(`/session/${g.sessionId}`)}
                  className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-t border-slate-800/70 px-3 py-3 text-right text-sm active:bg-slate-800/60"
                >
                  <span>
                    <span className="num block font-medium">{fmtDate(g.date)}</span>
                    {g.location && <span className="block truncate text-[11px] text-slate-500">{g.location}</span>}
                  </span>
                  <span className="num w-16 text-center text-slate-300">
                    {formatMoney(g.buyIn)}
                    <span className="block text-[10px] text-slate-500">×{g.buyInCount}</span>
                  </span>
                  <span className="num w-16 text-center text-slate-300">{formatMoney(g.cashOut)}</span>
                  <span className="w-16 text-left">
                    <Money value={g.net} />
                  </span>
                </button>
              ))}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-black/25 px-2 py-2">
      <div className="text-base">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}
