import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="bottom-nav-offset pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className="animate-toast flex max-w-sm items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/95 px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur"
          >
            {t.tone === 'success' && <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />}
            {t.tone === 'error' && <AlertTriangle size={18} className="shrink-0 text-rose-400" />}
            {t.tone === 'info' && <Info size={18} className="shrink-0 text-sky-400" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Runs an async action and shows an error toast on failure. */
export function useRun() {
  const toast = useToast();
  return useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (success) toast(success);
        return r;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'שגיאה', 'error');
        return undefined;
      }
    },
    [toast],
  );
}
