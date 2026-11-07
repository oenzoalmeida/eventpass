import { EmptyState, ErrorState, CardGridSkeleton, ListSkeleton } from '../components/ui';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link } from '../router/router';

function dayMonth(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
  };
}

export function HomePage() {
  const events = useAsync(() => api.publicEvents(), []);
  const board = useAsync(() => api.leaderboard(), []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <section aria-labelledby="eventos">
        <div className="mb-8 border-b-2 border-fg/70 pb-6">
          <p className="mb-3 flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.3em] text-primary">
            <span aria-hidden className="inline-block h-px w-10 bg-primary" />
            Temporada aberta
          </p>
          <h1 id="eventos" className="font-display text-5xl leading-[1.05] sm:text-6xl">
            Próximos eventos
          </h1>
          <p className="mt-4 max-w-lg text-base text-fg-muted">
            Inscreva-se, faça check-in no dia e acumule pontos.
          </p>
        </div>
        {events.status === 'loading' && <CardGridSkeleton />}
        {events.status === 'error' && <ErrorState error={events.error} onRetry={events.reload} />}
        {events.status === 'success' &&
          (events.data.length === 0 ? (
            <EmptyState title="Nenhum evento aberto no momento">
              <p>Volte em breve!</p>
              <p className="mt-3">
                Quer conhecer a jornada?{' '}
                <Link href="/demo" className="text-primary underline">
                  Veja uma demonstração com dados fictícios
                </Link>
                .
              </p>
            </EmptyState>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2">
              {events.data.map((e) => {
                const { day, month } = dayMonth(e.startsAt);
                return (
                  <li key={e.slug}>
                    <div className="relative flex h-full rounded-xl border border-fg/20 bg-surface shadow-[4px_4px_0_0_var(--ep-fg)] transition-transform hover:-translate-y-0.5">
                      <span
                        aria-hidden
                        className="absolute -top-2 left-[4.5rem] z-10 size-4 rounded-full border border-fg/20 bg-bg"
                      />
                      <span
                        aria-hidden
                        className="absolute -bottom-2 left-[4.5rem] z-10 size-4 rounded-full border border-fg/20 bg-bg"
                      />
                      <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-fg/30 py-5">
                        <span className="font-display text-3xl leading-none tabular-nums">{day}</span>
                        <span className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-fg-muted">
                          {month}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col p-5">
                        <h2 className="font-display text-xl leading-snug">
                          <Link href={`/e/${e.slug}`} className="after:absolute after:inset-0 hover:text-primary">
                            {e.title}
                          </Link>
                        </h2>
                        <p className="mt-1.5 font-mono text-xs text-fg-muted">{formatDateTime(e.startsAt)}</p>
                        {e.location && <p className="mt-0.5 text-sm text-fg-muted">{e.location}</p>}
                        <p className="mt-auto pt-4 text-sm font-semibold">
                          {e.isOpen ? (
                            <span className="text-success-strong">{e.spotsLeft} vagas disponíveis</span>
                          ) : (
                            <span className="font-mono text-xs uppercase tracking-[0.15em] text-fg-muted">
                              Inscrições encerradas
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}
      </section>

      <aside aria-labelledby="ranking">
        <div className="rounded-xl border border-fg/20 bg-surface p-5 shadow-[4px_4px_0_0_var(--ep-fg)]">
          <h2 id="ranking" className="font-display text-2xl">
            Ranking de participação
          </h2>
          <p className="mt-1.5 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-fg-muted">
            Presenças confirmadas
          </p>
          {board.status === 'loading' && <ListSkeleton rows={5} />}
          {board.status === 'error' && <p className="mt-3 text-sm text-fg-muted">Ranking indisponível.</p>}
          {board.status === 'success' &&
            (board.data.length === 0 ? (
              <p className="mt-4 text-sm text-fg-muted">Ninguém pontuou ainda. Seja a primeira pessoa!</p>
            ) : (
              <ol className="mt-4">
                {board.data.map((r) => (
                  <li
                    key={r.rank}
                    className="flex items-center gap-3 border-b border-dashed border-fg/20 py-2.5 text-sm last:border-0"
                  >
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${r.rank <= 3 ? 'bg-primary text-primary-fg' : 'bg-surface-muted text-fg-muted'}`}
                    >
                      <span className="sr-only">Posição </span>
                      {r.rank}
                    </span>
                    <span className="flex-1">{r.displayName}</span>
                    <span className="font-mono font-semibold tabular-nums">{r.points} pts</span>
                  </li>
                ))}
              </ol>
            ))}
        </div>
      </aside>
    </div>
  );
}
