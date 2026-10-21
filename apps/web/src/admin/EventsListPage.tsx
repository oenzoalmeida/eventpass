import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { formatDateTime } from '../lib/format';
import { Link } from '../router/router';
import { EmptyState, ErrorState, Loading } from '../components/ui';
import { EventStatusBadge } from '../components/EventStatusBadge';
import { PageHeader } from './AdminLayout';

export function EventsListPage() {
  const { status, data, error, reload } = useAsync(() => api.events(), []);

  return (
    <>
      <PageHeader
        title="Eventos"
        actions={
          <Link href="/admin/eventos/novo" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover">
            Novo evento
          </Link>
        }
      />
      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState error={error} onRetry={reload} />}
      {status === 'success' &&
        (data.length === 0 ? (
          <EmptyState title="Nenhum evento ainda">Crie um evento para começar a receber inscrições.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Lista de eventos</caption>
              <thead className="border-b border-border text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Evento</th>
                  <th scope="col" className="px-4 py-3 font-medium">Início</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Inscritos</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Check-ins</th>
                  <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/eventos/${e.id}`} className="font-medium hover:text-primary">
                        {e.title}
                      </Link>
                      {e.location && <p className="text-xs text-fg-muted">{e.location}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg-muted">{formatDateTime(e.startsAt)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {e.registrations}/{e.capacity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{e.checkins}</td>
                    <td className="px-4 py-3">
                      <EventStatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
