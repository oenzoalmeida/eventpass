import type { ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-8 text-sm text-fg-muted">
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </p>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <Alert tone="danger" title="Não foi possível carregar">
      <p>{error.message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </Alert>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-medium text-fg">{title}</p>
      {children && <div className="mt-2 text-sm text-fg-muted">{children}</div>}
    </div>
  );
}
