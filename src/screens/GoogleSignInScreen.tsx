import { useEffect, useState } from 'react';
import { useData } from '../data/DataContext';
import { Button, Card } from '../components/ui';

export function GoogleSignInScreen() {
  const { signInWithGoogle, error: serviceError, authUser } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authUser) {
      setBusy(false);
      setError(null);
    }
  }, [authUser]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'לא ניתן להתחבר באמצעות Google');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-safe mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 pb-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <img src="/icon.svg" alt="" className="h-24 w-24 rounded-[1.75rem] shadow-2xl shadow-red-500/20" />
        <h1 className="mt-5 text-3xl font-extrabold">פוקר בין חברים</h1>
        <p className="mt-2 max-w-xs text-slate-400">התחברו כדי לראות את הקבוצות, המשחקים והסטטיסטיקות שלכם.</p>
      </div>
      <Card className="space-y-4">
        <Button size="lg" block disabled={busy} onClick={signIn}>
          <GoogleMark />
          {busy ? 'מתחבר…' : 'התחבר עם Google'}
        </Button>
        {(error || serviceError) && (
          <p role="alert" className="break-words text-center text-sm text-red-300">
            {error || serviceError}
          </p>
        )}
      </Card>
      <p className="mt-5 text-center text-xs text-slate-500">הפרופיל ושם המשתמש ייטענו מחשבון Google שלכם.</p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5 rounded-full bg-white p-0.5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.94 46.98 31.7 46.98 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
