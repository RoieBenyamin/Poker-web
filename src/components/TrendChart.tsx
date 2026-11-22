import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GameResult } from '../lib/stats';
import { fmtShortDate, fmtDate } from '../lib/format';
import { formatSigned, ltr, toCents, fromCents } from '../lib/money';

interface Point {
  label: string;
  date: string;
  net: number;
  cumulative: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl" dir="rtl">
      <div className="mb-1 font-semibold text-slate-200">{fmtDate(p.date)}</div>
      <div className={p.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
        במשחק: <span className="num font-bold">{ltr(formatSigned(p.net))}</span>
      </div>
      <div className="text-sky-300">
        מצטבר: <span className="num font-bold">{ltr(formatSigned(p.cumulative))}</span>
      </div>
    </div>
  );
}

/** Per-game P/L bars + cumulative line for the selected games (newest-first input). */
export function TrendChart({ games }: { games: GameResult[] }) {
  let cum = 0;
  const data: Point[] = [...games].reverse().map((g) => {
    cum += toCents(g.net);
    return { label: fmtShortDate(g.date), date: g.date, net: g.net, cumulative: fromCents(cum) };
  });

  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" vertical={false} />
          {/* reversed: in RTL time flows right → left (oldest on the right) */}
          <XAxis dataKey="label" reversed tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${v}₪`} />
          <ReferenceLine y={0} stroke="#475569" />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="net" radius={[6, 6, 6, 6]} maxBarSize={36}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.net >= 0 ? '#10b981' : '#f43f5e'} fillOpacity={0.9} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="cumulative" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2.5, fill: '#38bdf8' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
