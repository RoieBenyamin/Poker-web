import { useState } from 'react';
import { Check, Copy, Crown, Plus, RefreshCw, Shield, Users, X } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Header } from '../components/Header';
import { useRun, useToast } from '../components/Toast';
import { Avatar, Button, Card, EmptyState, Field, inputCls, MoneyInput, SectionTitle } from '../components/ui';
import { copyText } from '../lib/whatsapp';
import { formatMoney } from '../lib/money';

export function GroupsScreen() {
  const { groups, allSessions, activeGroup, me, getPlayer, setGroupId, actions, isGroupAdmin } = useData();
  const run = useRun();
  const toast = useToast();
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState('50');
  const [emoji, setEmoji] = useState('');
  const [code, setCode] = useState(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('code') ?? '');

  const groupSessions = (id: string) => allSessions.filter((s) => s.groupId === id);
  const activeCount = (id: string) => groupSessions(id).filter((s) => s.phase === 'active').length;
  const create = async () => {
    const id = await run(() => actions.createGroup(name, Number(buyIn), emoji));
    if (id) {
      setName('');
      setEmoji('');
      setGroupId(id);
    }
  };
  const join = async () => {
    await run(() => actions.joinGroup(code), 'הצטרפת לקבוצה');
    setCode('');
  };
  const invite = async () => {
    if (!activeGroup) return;
    const link = `${window.location.origin}${window.location.pathname}#/groups?code=${activeGroup.inviteCode}`;
    const ok = await copyText(link);
    toast(ok ? 'קישור ההזמנה הועתק — אפשר לשלוח בוואטסאפ' : 'העתקת הקישור נכשלה', ok ? 'success' : 'error');
  };

  return (
    <>
      <Header title="הקבוצות שלי" subtitle={`${groups.length} קבוצות`} />
      <div className="space-y-5 px-4 pt-4">
        {groups.length === 0 && (
          <Card className="!p-0">
            <EmptyState
              icon={<Users size={30} />}
              title="עדיין אין לך קבוצות"
              text="צור קבוצה חדשה לערבי הפוקר שלך, או הצטרף לקבוצה קיימת באמצעות קוד הזמנה."
              action={
                <div className="flex w-full flex-col gap-2">
                  <Button size="lg" block onClick={() => document.getElementById('create-group')?.scrollIntoView({ behavior: 'smooth' })}>
                    <Plus size={19} /> צור קבוצת פוקר ראשונה
                  </Button>
                  <Button variant="outline" size="lg" block onClick={() => document.getElementById('join-group')?.scrollIntoView({ behavior: 'smooth' })}>
                    הצטרף לקבוצה עם קוד
                  </Button>
                </div>
              }
            />
          </Card>
        )}
        {groups.length > 0 && (
          <div className="space-y-2.5">
            {groups.map((group) => {
              const isSelected = group.id === activeGroup?.id;
              const liveCount = activeCount(group.id);
              return (
                <Card
                  key={group.id}
                  onClick={() => setGroupId(group.id)}
                  className={`flex items-center gap-3 !p-3.5 ${isSelected ? '!border-red-500/60 !bg-red-950/20' : ''}`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-2xl">
                    {group.emoji || '♠️'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{group.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><Users size={13} />{group.members.length} חברים</span>
                      <span>·</span>
                      <span>{liveCount ? `${liveCount} משחק פעיל` : 'אין משחק פעיל'}</span>
                    </div>
                  </div>
                  {isSelected && <Check size={19} className="text-red-400" />}
                </Card>
              );
            })}
          </div>
        )}

        {activeGroup && (
          <Card>
            <div className="flex w-full flex-col items-stretch gap-3">
              <div className="w-full min-w-0">
                <div className="break-words font-bold">הזמנה לקבוצת {activeGroup.name}</div>
                <div className="mt-1 text-sm text-slate-400">קוד הצטרפות</div>
                <div
                  className="num mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xl font-extrabold tracking-[0.2em] text-red-300 sm:text-2xl sm:tracking-[0.3em]"
                  dir="ltr"
                >
                  {activeGroup.inviteCode}
                </div>
              </div>
              <Button variant="outline" block onClick={invite} className="whitespace-normal leading-tight">
                <Copy size={17} /> העתק קישור הזמנה לוואטסאפ
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <span>כניסה ברירת מחדל: {formatMoney(activeGroup.defaultBuyIn)}</span>
              {isGroupAdmin && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-300">מנהל</span>}
            </div>
            {isGroupAdmin && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => run(() => actions.resetInviteCode(), 'קוד ההזמנה אופס')}>
                <RefreshCw size={15} /> איפוס קוד הזמנה
              </Button>
            )}
            {isGroupAdmin && (
              <SectionTitle>
                <span className="inline-flex items-center gap-1.5"><Users size={15} /> חברי הקבוצה</span>
              </SectionTitle>
            )}
            {isGroupAdmin && activeGroup.members.map((member) => {
              const player = getPlayer(member.playerId);
              if (!player) return null;
              const isSelf = player.id === me?.id;
              return (
                <div key={member.playerId} className="flex items-center gap-2 border-t border-slate-800/70 py-2.5">
                  <Avatar name={player.name} id={player.id} size="sm" />
                  <span className="flex-1 font-medium">{player.name}{isSelf ? ' (אני)' : ''}</span>
                  <span className={`inline-flex items-center gap-1 text-xs ${member.role === 'admin' ? 'text-amber-300' : 'text-slate-500'}`}>
                    {member.role === 'admin' && <Crown size={13} />} {member.role === 'admin' ? 'מנהל' : 'חבר'}
                  </span>
                  {!isSelf && (
                    <>
                      <button
                        type="button"
                        aria-label={member.role === 'admin' ? 'הסר מנהל' : 'מנה לחבר כמנהל'}
                        className="rounded-lg p-2 text-slate-400 active:bg-slate-800"
                        onClick={() => run(() => actions.setMemberRole(member.playerId, member.role === 'admin' ? 'member' : 'admin'), 'הרשאות עודכנו')}
                      >
                        <Shield size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="הסר מהקבוצה"
                        className="rounded-lg p-2 text-red-300 active:bg-red-950/40"
                        onClick={() => run(() => actions.removeGroupMember(member.playerId), 'החבר הוסר מהקבוצה')}
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        <Card id="create-group">
          <SectionTitle>יצירת קבוצה חדשה מאפס</SectionTitle>
          <div className="space-y-3">
            <Field label="שם הקבוצה">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="חמישי אצל דני" maxLength={40} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="כניסה ברירת מחדל (₪)">
                <MoneyInput value={buyIn} onChange={setBuyIn} />
              </Field>
              <Field label="אייקון / אימוג׳י (אופציונלי)">
                <input className={inputCls} value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="♠️" maxLength={4} />
              </Field>
            </div>
            <Button block onClick={create} disabled={!name.trim() || Number(buyIn) <= 0}>
              <Plus size={19} /> צור קבוצת פוקר
            </Button>
          </div>
        </Card>

        <Card id="join-group">
          <SectionTitle>הצטרפות לקבוצה עם קוד</SectionTitle>
          <div className="flex gap-2">
            <input
              className={`${inputCls} num text-center uppercase tracking-[0.25em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              dir="ltr"
            />
            <Button onClick={join} disabled={code.length !== 6}>הצטרף</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
