import type { AdminEvent } from '@eventpass/shared';
import { ErrorState, Loading, Stat } from '../components/ui';
import { api } from '../lib/api';
import { formatNumber, formatPercent, formatTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function ReportPanel({ event }: { event: AdminEvent }) {
  const { status, data, error, reload } = useAsync(() => api.report(event.id), [event.id, event.checkins, event.registrations]);
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState error={error} onRetry={reload} />;

  const max = Math.max(1, ...data.checkinsByHour.map((h) => h.count));

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Inscrições" value={formatNumber(data.confirmed)} hint={`${data.cancelled} canceladas`} />
        <Stat label="Ocupação" value={formatPercent(data.occupancyRate)} hint={`${data.confirmed} de ${event.capacity} vagas`} />
        <Stat label="Presença" value={formatPercent(data.attendanceRate)} hint={`${data.checkins} check-ins`} />
        <Stat label="Pontos lançados" value={formatNumber(data.pointsAwarded)} />
      </dl>

      <section aria-labelledby="por-hora">
        <h3 id="por-hora" className="mb-3 text-sm font-semibold">
          Check-ins por hora
        </h3>
        {data.checkinsByHour.length === 0 ? (
          <p className="text-sm text-fg-muted">Nenhum check-in registrado.</p>
        ) : (
          <table className="w-full max-w-lg text-sm">
            <caption className="sr-only">Quantidade de check-ins por hora</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Check-ins</th>
              </tr>
            </thead>
            <tbody>
              {data.checkinsByHour.map((h) => (
                <tr key={h.hour}>
                  <th scope="row" className="w-16 py-1 pr-3 text-left font-normal tabular-nums text-fg-muted">
                    {formatTime(h.hour)}
                  </th>
                  <td className="py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-5 rounded bg-primary" style={{ width: `${(h.count / max) * 100}%`, minWidth: '4px' }} />
                      <span className="tabular-nums">{h.count}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <a
        href={api.registrationsCsvUrl(event.id)}
        download
        className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
      >
        Exportar inscrições (CSV)
      </a>
    </div>
  );
}
