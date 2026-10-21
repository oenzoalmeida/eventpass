import { Card, EmptyState, ErrorState, Loading } from '../components/ui';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link } from '../router/router';

export function HomePage() {
  const events = useAsync(() => api.publicEvents(), []);
  const board = useAsync(() => api.leaderboard(), []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <section aria-labelledby="eventos">
        <h1 id="eventos" className="mb-1 text-2xl font-bold">
          Próximos eventos
        </h1>
        <p className="mb-6 text-sm text-fg-muted">Inscreva-se, faça check-in no dia e acumule pontos.</p>
        {events.status === 'loading' && <Loading />}
        {events.status === 'error' && <ErrorState error={events.error} onRetry={events.reload} />}
        {events.status === 'success' &&
          (events.data.length === 0 ? (
            <EmptyState title="Nenhum evento aberto no momento">Volte em breve!</EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {events.data.map((e) => (
                <li key={e.slug}>
                  <Card className="relative flex h-full flex-col">
                    <h2 className="text-base font-semibold">
                      <Link href={`/e/${e.slug}`} className="after:absolute after:inset-0 hover:text-primary">
                        {e.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-fg-muted">{formatDateTime(e.startsAt)}</p>
                    {e.location && <p className="text-sm text-fg-muted">{e.location}</p>}
                    <p className="mt-auto pt-4 text-sm">
                      {e.isOpen ? (
                        <span className="text-success">{e.spotsLeft} vagas disponíveis</span>
                      ) : (
                        <span className="text-fg-muted">Inscrições encerradas</span>
                      )}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <aside aria-labelledby="ranking">
        <Card>
          <h2 id="ranking" className="text-base font-semibold">
            Ranking de participação
          </h2>
          <p className="mt-1 text-xs text-fg-muted">Pontos ganhos com presença confirmada.</p>
          {board.status === 'loading' && <Loading />}
          {board.status === 'error' && <p className="mt-3 text-sm text-fg-muted">Ranking indisponível.</p>}
          {board.status === 'success' &&
            (board.data.length === 0 ? (
              <p className="mt-4 text-sm text-fg-muted">Ninguém pontuou ainda. Seja a primeira pessoa!</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {board.data.map((r) => (
                  <li key={r.rank} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${r.rank <= 3 ? 'bg-primary text-primary-fg' : 'bg-surface-muted text-fg-muted'}`}
                    >
                      <span className="sr-only">Posição </span>
                      {r.rank}
                    </span>
                    <span className="flex-1">{r.displayName}</span>
                    <span className="font-semibold tabular-nums">{r.points} pts</span>
                  </li>
                ))}
              </ol>
            ))}
        </Card>
      </aside>
    </div>
  );
}
