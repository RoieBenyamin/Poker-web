import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useData } from '../data/DataContext';
import { Button, Card, Field, inputCls, Segmented } from '../components/ui';

type AuthMode = 'signin' | 'signup';

export function AuthScreen() {
  const { signInWithEmail, signUpWithEmail, sendPasswordReset, error: serviceError, authUser } = useData();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (authUser) {
      setBusy(false);
      setError(null);
    }
  }, [authUser]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('יש להזין כתובת אימייל.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('כתובת האימייל אינה תקינה.');
      return;
    }
    if (!password) {
      setError('יש להזין סיסמה.');
      return;
    }
    if (mode === 'signup' && !displayName.trim()) {
      setError('יש להזין שם מלא.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') await signUpWithEmail(displayName.trim(), email.trim(), password);
      else await signInWithEmail(email.trim(), password);
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('יש להזין כתובת אימייל כדי לאפס את הסיסמה.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      setNotice('אם הכתובת משויכת לחשבון, נשלח אליה קישור לאיפוס הסיסמה.');
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 pb-10">
      <div className="mb-7 flex flex-col items-center text-center">
        <img src="/icon.svg" alt="" className="h-24 w-24 rounded-[1.75rem] shadow-2xl shadow-red-500/20" />
        <h1 className="mt-5 text-3xl font-extrabold">פוקר בין חברים</h1>
        <p className="mt-2 max-w-xs text-slate-400">התחברו או הירשמו כדי להיכנס לקבוצות ולנהל את המשחקים שלכם.</p>
      </div>

      <Card>
        <Segmented<AuthMode>
          options={[
            { value: 'signin', label: 'התחברות' },
            { value: 'signup', label: 'הרשמה' },
          ]}
          value={mode}
          onChange={(value) => {
            setMode(value);
            setError(null);
            setNotice(null);
          }}
        />

        <form noValidate className="mt-5 space-y-4" onSubmit={submit}>
          {mode === 'signup' && (
            <Field label="שם מלא">
              <div className="relative">
                <UserRound size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className={`${inputCls} pr-11`}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                />
              </div>
            </Field>
          )}
          <Field label="אימייל">
            <div className="relative">
              <Mail size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputCls} pr-11 text-left`}
                type="email"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </Field>
          <Field label="סיסמה">
            <div className="relative">
              <LockKeyhole size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputCls} pr-11 text-left`}
                type="password"
                dir="ltr"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={mode === 'signup' ? 6 : undefined}
              />
            </div>
            {mode === 'signup' && <span className="mt-1 block text-xs text-slate-500">לפחות 6 תווים</span>}
          </Field>

          {mode === 'signin' && (
            <div className="text-left">
              <button
                type="button"
                className="text-sm font-medium text-red-300 underline-offset-4 hover:underline disabled:opacity-50"
                onClick={resetPassword}
                disabled={busy}
              >
                שכחתי סיסמה
              </button>
            </div>
          )}

          <Button type="submit" size="lg" block disabled={busy}>
            <KeyRound size={19} />
            {busy ? (mode === 'signup' ? 'יוצר חשבון…' : 'מתחבר…') : mode === 'signup' ? 'יצירת חשבון' : 'התחברות'}
          </Button>
        </form>

        {(error || serviceError) && (
          <p role="alert" className="mt-4 break-words text-center text-sm text-red-300">
            {error || serviceError}
          </p>
        )}
        {notice && <p role="status" className="mt-4 text-center text-sm text-emerald-300">{notice}</p>}
      </Card>
    </div>
  );
}

function readableError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'אירעה שגיאה. נסו שוב.';
}
