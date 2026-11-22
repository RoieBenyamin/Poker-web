import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button, Field, inputCls } from './ui';

/** Name + optional phone form, used for creating / editing players. */
export function PlayerForm({
  initialName = '',
  initialPhone = '',
  submitLabel = 'הוסף שחקן',
  onSubmit,
  existingNames = [],
}: {
  initialName?: string;
  initialPhone?: string;
  submitLabel?: string;
  onSubmit: (name: string, phone: string) => void | Promise<void>;
  existingNames?: string[];
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const duplicate = trimmed !== initialName.trim() && existingNames.some((n) => n.trim() === trimmed);
  const phoneOk = phone.trim() === '' || /^[\d\s\-+()]{7,}$/.test(phone.trim());

  const submit = async () => {
    if (!trimmed || duplicate || !phoneOk || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed, phone.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="שם" hint={duplicate ? 'כבר קיים שחקן עם השם הזה' : undefined}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: אבי" maxLength={24} autoComplete="off" />
      </Field>
      <Field label="טלפון (אופציונלי – לביט / פייבוקס)" hint={!phoneOk ? 'מספר טלפון לא תקין' : undefined}>
        <input
          className={inputCls}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="050-0000000"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
        />
      </Field>
      <Button type="submit" block size="lg" disabled={!trimmed || duplicate || !phoneOk || busy}>
        <UserPlus size={20} />
        {submitLabel}
      </Button>
    </form>
  );
}
