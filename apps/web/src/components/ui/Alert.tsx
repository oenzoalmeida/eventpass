import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'info' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = {
  info: 'border-primary/30 bg-primary/10 text-fg',
  success: 'border-success/30 bg-success/10 text-fg',
  warning: 'border-warning/40 bg-warning/10 text-fg',
  danger: 'border-danger/30 bg-danger/10 text-fg',
};

export function Alert({ tone = 'info', title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-1', 'text-fg-muted')}>{children}</div>}
    </div>
  );
}
