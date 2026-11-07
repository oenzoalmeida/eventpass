import type { CSSProperties } from 'react';

/** Bloco de esqueleto: placeholder no formato do conteúdo que está chegando. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`ep-skeleton block rounded-md bg-surface-muted ${className}`} style={style} />;
}

function Status({ label }: { label: string }) {
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Esqueleto genérico de página inteira (título + grade de cartões). */
export function PageSkeleton({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="py-4">
      <Status label={label} />
      <Skeleton className="mb-6 h-7 w-44" />
      <CardGridSkeleton />
    </div>
  );
}

/** Grade de cartões (eventos públicos). */
export function CardGridSkeleton({ count = 4, label = 'Carregando…' }: { count?: number; label?: string }) {
  return (
    <div>
      <Status label={label} />
      <ul className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="mb-1 h-4 w-1/2" />
            <Skeleton className="mb-4 h-4 w-2/5" />
            <Skeleton className="h-4 w-1/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lista com linhas simples (ranking, listas de eventos). */
export function ListSkeleton({ rows = 5, label = 'Carregando…' }: { rows?: number; label?: string }) {
  return (
    <div>
      <Status label={label} />
      <ol className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Blocos de estatísticas (dashboards admin). */
export function StatsSkeleton({ count = 4, label = 'Carregando…' }: { count?: number; label?: string }) {
  return (
    <div>
      <Status label={label} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="mb-2 h-7 w-14" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tabela (painéis admin com colunas). */
export function TableSkeleton({ rows = 6, label = 'Carregando…' }: { rows?: number; label?: string }) {
  return (
    <div>
      <Status label={label} />
      <div className="rounded-xl border border-border bg-surface p-4">
        <Skeleton className="mb-4 h-4 w-full" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="mb-3 h-4 w-full last:mb-0" />
        ))}
      </div>
    </div>
  );
}
