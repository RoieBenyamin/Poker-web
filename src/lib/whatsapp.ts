import type { Player, Session } from '../types';
import { formatMoney, formatSigned } from './money';
import { playerLines, sessionTotals } from './settlement';
import { fmtLongDate, fmtTime, daysAgoLabel } from './format';
import type { OpenDebt } from './stats';

type NameOf = (id: string) => string;

export const nameLookup = (players: Player[]): NameOf => {
  const map = new Map(players.map((p) => [p.id, p.name]));
  return (id) => map.get(id) ?? 'שחקן לא ידוע';
};

/** Summary message for the WhatsApp group. */
export function sessionSummaryText(session: Session, players: Player[]): string {
  const name = nameLookup(players);
  const totals = sessionTotals(session);
  const lines = playerLines(session)
    .map((l) => ({ ...l, final: session.results?.[l.playerId] ?? l.net ?? 0 }))
    .sort((a, b) => b.final - a.final);

  const out: string[] = [];
  out.push(`♠️ *סיכום ערב פוקר* ♥️`);
  out.push(`📅 ${fmtLongDate(session.date)} · ${fmtTime(session.date)}`);
  if (session.location) out.push(`📍 ${session.location}`);
  out.push(`💰 קופה: ${formatMoney(totals.totalIn)} · ${totals.playerCount} שחקנים`);
  out.push('');
  out.push('*מאזן שחקנים:*');
  lines.forEach((l, i) => {
    const icon = l.final > 0 ? '🟢' : l.final < 0 ? '🔴' : '⚪';
    const medal = i === 0 && l.final > 0 ? ' 🏆' : '';
    out.push(`${icon} ${name(l.playerId)}: ${formatSigned(l.final)} (נכנס ${formatMoney(l.buyIn)}, יצא ${formatMoney(l.cashOut ?? 0)})${medal}`);
  });
  if (session.approvedDiff) {
    out.push(`⚠️ הפרש קופה של ${formatMoney(session.approvedDiff)} אושר וחולק באופן יחסי`);
  }
  out.push('');
  if (session.transfers.length === 0) {
    out.push('✅ אין צורך בהעברות');
  } else {
    out.push('*העברות:*');
    for (const t of session.transfers) {
      out.push(`${t.paid ? '✅' : '💸'} ${name(t.from)} ⬅️ מעביר ${formatMoney(t.amount)} ל-${name(t.to)}${t.paid ? ' (שולם)' : ''}`);
    }
  }
  return out.join('\n');
}

/** Friendly reminder for an unpaid transfer. */
export function reminderText(debt: OpenDebt, players: Player[]): string {
  const name = nameLookup(players);
  const to = players.find((p) => p.id === debt.to);
  const lines = [
    `היי ${name(debt.from)} 👋`,
    `תזכורת קטנה מערב הפוקר של ${fmtLongDate(debt.sessionDate)} (${daysAgoLabel(debt.daysAgo)}):`,
    `💸 נשאר להעביר ${formatMoney(debt.amount)} ל-${name(debt.to)}`,
  ];
  if (to?.phone) lines.push(`📱 ביט / פייבוקס: ${to.phone}`);
  lines.push('תודה! ♠️');
  return lines.join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older iOS / non-secure contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
