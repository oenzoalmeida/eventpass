import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { formatDateTime, formatNumber } from '../lib/format';
import { Link } from '../router/router';
import { Card, EmptyState, ErrorState, Loading, Stat } from '../components/ui';
import { EventStatusBadge } from '../components/EventStatusBadge';
import { PageHeader } from './AdminLayout';

export function DashboardPage() {
  const { status, data, error, reload } = useAsync(() => api.dashboard(), []);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Resumo dos seus eventos e da participação."
        actions={
          <Link href="/admin/eventos/novo" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover">
            Novo evento
          </Link>
        }
      />
      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState error={error} onRetry={reload} />}
      {status === 'success' && (
        <div className="space-y-8">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Eventos"
              value={formatNumber(data.events.total)}
              hint={`${data.events.published} publicados · ${data.events.draft} rascunhos`}
            />
            <Stat label="Inscrições" value={formatNumber(data.registrations)} hint="confirmadas" />
            <Stat label="Check-ins" value={formatNumber(data.checkins)} />
            <Stat label="Pontos distribuídos" value={formatNumber(data.points)} hint={`${data.participants} participantes`} />
          </dl>

          <section aria-labelledby="proximos">
            <h2 id="proximos" className="mb-3 text-lg font-semibold">
              Próximos eventos
            </h2>
            {data.upcoming.length === 0 ? (
              <EmptyState title="Nenhum evento futuro">
                <Link href="/admin/eventos/novo" className="text-primary underline">
                  Crie o primeiro evento
                </Link>
              </EmptyState>
            ) : (
              <ul className="grid gap-3">
                {data.upcoming.map((e) => (
                  <li key={e.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <Link href={`/admin/eventos/${e.id}`} className="font-medium hover:text-primary">
                          {e.title}
                        </Link>
                        <p className="text-sm text-fg-muted">{formatDateTime(e.startsAt)}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-fg-muted">
                        <span>
                          {e.registrations}/{e.capacity} inscritos
                        </span>
                        <EventStatusBadge status={e.status} />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
