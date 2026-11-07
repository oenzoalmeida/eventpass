import { Card, EmptyState, ErrorState, CardGridSkeleton, ListSkeleton } from '../components/ui';
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
      <section aria-labelledby="eventos" className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-0 h-56 w-full rounded-full bg-[radial-gradient(closest-side,var(--ep-primary),transparent)] opacity-25 blur-3xl"
        />
        <p className="relative mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-success">
          Agenda aberta
        </p>
        <h1 id="eventos" className="relative mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Próximos <span className="text-primary">eventos</span>
        </h1>
        <p className="relative mb-8 max-w-lg text-base text-fg-muted">
          Inscreva-se, faça check-in no dia e acumule pontos.
        </p>
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
            <ul className="relative grid gap-5 sm:grid-cols-2">
              {events.data.map((e) => {
                const { day, month } = dayMonth(e.startsAt);
                return (
                  <li key={e.slug}>
                    <Card className="relative flex h-full gap-4 rounded-2xl border-primary/30 bg-surface/70 shadow-[0_0_45px_-18px_var(--ep-primary)] backdrop-blur-sm transition-transform hover:-translate-y-0.5">
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center self-start rounded-xl bg-primary/15 px-2 py-3 text-primary">
                        <span className="text-2xl font-bold leading-none tabular-nums">{day}</span>
                        <span className="mt-1 text-[0.65rem] font-semibold tracking-[0.2em]">{month}</span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h2 className="text-lg font-semibold tracking-tight">
                          <Link href={`/e/${e.slug}`} className="after:absolute after:inset-0 hover:text-primary">
                            {e.title}
                          </Link>
                        </h2>
                        <p className="mt-1 text-sm text-fg-muted">{formatDateTime(e.startsAt)}</p>
                        {e.location && <p className="text-sm text-fg-muted">{e.location}</p>}
                        <p className="mt-auto pt-4 text-sm font-medium">
                          {e.isOpen ? (
                            <span className="text-success">
                              <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-success align-middle" />
                              {e.spotsLeft} vagas disponíveis
                            </span>
                          ) : (
                            <span className="text-fg-muted">Inscrições encerradas</span>
                          )}
                        </p>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ))}
      </section>

      <aside aria-labelledby="ranking" className="relative">
        <Card className="rounded-2xl border-primary/30 bg-surface/70 backdrop-blur-sm">
          <h2 id="ranking" className="text-lg font-semibold tracking-tight">
            Ranking de participação
          </h2>
          <p className="mt-1 text-xs text-fg-muted">Pontos ganhos com presença confirmada.</p>
          {board.status === 'loading' && <ListSkeleton rows={5} />}
          {board.status === 'error' && <p className="mt-3 text-sm text-fg-muted">Ranking indisponível.</p>}
          {board.status === 'success' &&
            (board.data.length === 0 ? (
              <p className="mt-4 text-sm text-fg-muted">Ninguém pontuou ainda. Seja a primeira pessoa!</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {board.data.map((r) => (
                  <li key={r.rank} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${r.rank <= 3 ? 'bg-success text-primary-fg shadow-[0_0_14px_-2px_var(--ep-success)]' : 'bg-surface-muted text-fg-muted'}`}
                    >
                      <span className="sr-only">Posição </span>
                      {r.rank}
                    </span>
                    <span className="flex-1">{r.displayName}</span>
                    <span className="font-semibold tabular-nums text-primary">{r.points} pts</span>
                  </li>
                ))}
              </ol>
            ))}
        </Card>
      </aside>
    </div>
  );
}
