import { Share2 } from 'lucide-react';
import type { Session } from '../types';
import { sessionLink } from '../lib/router';
import { copyText } from '../lib/whatsapp';
import { fmtLongDate } from '../lib/format';
import { useToast } from './Toast';
import { Button, IconButton } from './ui';

/** Shares a direct link to a game (native share sheet when available, otherwise copy). */
export function useShareSession() {
  const toast = useToast();
  return async (session: Session) => {
    const url = sessionLink(session.id);
    const title = `פוקר – ${fmtLongDate(session.date)}`;
    const text = `♠️ מצטרפים לשולחן? הזינו כניסות ויציאות כאן:`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const ok = await copyText(url);
    toast(ok ? 'הקישור למשחק הועתק 🔗' : 'לא הצלחתי להעתיק', ok ? 'success' : 'error');
  };
}

export function ShareSessionButton({ session, variant = 'icon' }: { session: Session; variant?: 'icon' | 'button' }) {
  const share = useShareSession();
  if (variant === 'button')
    return (
      <Button variant="secondary" onClick={() => share(session)}>
        <Share2 size={18} />
        שתף קישור
      </Button>
    );
  return (
    <IconButton label="שתף קישור למשחק" onClick={() => share(session)}>
      <Share2 size={21} />
    </IconButton>
  );
}
