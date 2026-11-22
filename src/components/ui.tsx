import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { SessionStatus } from '../types';
import { CURRENCY, formatSigned, ltr, moneyTone, parseAmount } from '../lib/money';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-lg shadow-red-600/20',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-900 border border-slate-700/60',
  outline: 'border border-red-500/50 text-red-300 hover:bg-red-500/10 active:bg-red-500/20',
  ghost: 'text-slate-300 hover:bg-slate-800/70 active:bg-slate-800',
  danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25 active:bg-rose-500/30',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-12 px-4 text-base rounded-2xl gap-2',
  lg: 'h-14 px-5 text-lg rounded-2xl gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, children, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-300 transition-colors hover:bg-slate-800 active:bg-slate-700 disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Layout bits                                                         */
/* ------------------------------------------------------------------ */

export function Card({ id, className, children, onClick }: { id?: string; className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      id={id}
      onClick={onClick}
      className={cx(
        'block w-full rounded-3xl border border-slate-800/80 bg-slate-900/70 p-4 text-right shadow-xl shadow-black/20 backdrop-blur',
        onClick && 'transition-colors hover:border-slate-700 active:bg-slate-800/80',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-sm font-semibold tracking-wide text-slate-400">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-800/70 text-slate-400">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Money({ value, signed = true, className }: { value: number; signed?: boolean; className?: string }) {
  return (
    <span className={cx('num font-semibold', signed && moneyTone(value), className)}>
      {signed ? ltr(formatSigned(value)) : ltr(`${Math.abs(value).toLocaleString('he-IL', { maximumFractionDigits: 2 })}${CURRENCY}`)}
    </span>
  );
}

const AVATAR_COLORS = [
  'from-red-500 to-rose-700',
  'from-sky-500 to-indigo-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-600',
  'from-rose-500 to-red-600',
  'from-lime-500 to-green-600',
  'from-cyan-500 to-blue-600',
];

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' | 'lg' }) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];
  const dim = size === 'sm' ? 'h-8 w-8 text-sm' : size === 'lg' ? 'h-14 w-14 text-xl' : 'h-11 w-11 text-base';
  return (
    <div className={cx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-md', color, dim)}>
      {name.trim().charAt(0) || '?'}
    </div>
  );
}

const STATUS: Record<SessionStatus, { label: string; cls: string; dot: string }> = {
  active: { label: 'פעיל', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400 live-dot' },
  pending: { label: 'ממתין לתשלומים', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
  settled: { label: 'סגור ושולם', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30', dot: 'bg-slate-300' },
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const s = STATUS[status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium', s.cls)}>
      <span className={cx('h-2 w-2 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export const inputCls =
  'h-12 w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 text-base text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** Money input – only accepts non-negative numbers, numeric keypad on mobile. */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const invalid = value !== '' && parseAmount(value) === null;
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        autoFocus={autoFocus}
        placeholder={placeholder ?? '0'}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className={cx(inputCls, 'num pl-10 text-left text-lg font-semibold', invalid && 'border-rose-500')}
      />
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{CURRENCY}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom sheet / dialog                                               */
/* ------------------------------------------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className="animate-sheet relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[2rem] border border-slate-800 bg-slate-900 shadow-2xl sm:rounded-[2rem]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-700 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <IconButton label="סגור" onClick={onClose} className="-ml-2">
            <X size={22} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-slate-800 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>
  );
}

/** Promise-free confirm dialog built on Sheet */
export function ConfirmSheet({
  open,
  title,
  text,
  confirmLabel = 'אישור',
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" block onClick={onClose}>
            ביטול
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            block
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {text && <div className="text-slate-300">{text}</div>}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-slate-950/60 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'h-10 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors',
            o.value === value ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useToggle(initial = false) {
  const [v, setV] = useState(initial);
  return [v, () => setV((x) => !x), setV] as const;
}
