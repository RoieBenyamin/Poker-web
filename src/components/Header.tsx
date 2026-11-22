import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { IconButton } from './ui';

export function Header({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-slate-800/50 bg-[#09090B]/90 backdrop-blur-xl">
      <div className="flex min-h-14 items-center gap-1 px-3 py-1.5">
        {back && (
          <IconButton label="חזרה" onClick={back}>
            <ChevronRight size={26} />
          </IconButton>
        )}
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-0.5">{actions}</div>}
      </div>
    </header>
  );
}
