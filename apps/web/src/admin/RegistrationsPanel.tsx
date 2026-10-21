import { useMemo, useState } from 'react';
import type { AdminEvent } from '@eventpass/shared';
import { Badge, Button, EmptyState, ErrorState, Input, Loading } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';

export function RegistrationsPanel({ event, onChange }: { event: AdminEvent; onChange: () => void }) {
  const { status, data, error, reload } = useAsync(() => api.registrations(event.id), [event.id, event.checkins]);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (r) => !q || r.participantName.toLowerCase().includes(q) || r.participantEmail.toLowerCase().includes(q),
    );
  }, [data, query]);

  async function cancel(id: number, name: string) {
    if (!window.confirm(`Cancelar a inscrição de ${name}? A vaga será liberada.`)) return;
    setActionError(null);
    try {
      await api.cancelRegistration(event.id, id);
      reload();
      onChange();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Não foi possível cancelar.');
    }
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState error={error} onRetry={reload} />;
  if (data.length === 0) {
    return <EmptyState title="Nenhuma inscrição ainda">Compartilhe a página pública do evento para receber inscrições.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <Input label="Buscar participante" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <a
          href={api.registrationsCsvUrl(event.id)}
          download
          className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
        >
          Exportar CSV
        </a>
      </div>
      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Inscrições do evento {event.title}, {filtered.length} de {data.length}
          </caption>
          <thead className="border-b border-border text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Participante</th>
              <th scope="col" className="px-4 py-3 font-medium">Inscrição</th>
              <th scope="col" className="px-4 py-3 font-medium">Presença</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Pontos</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.participantName}</p>
                  <p className="text-xs text-fg-muted">{r.participantEmail}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                  {r.status === 'cancelled' ? <Badge tone="danger">Cancelada</Badge> : formatDateTime(r.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.checkedInAt ? <Badge tone="success">{formatDateTime(r.checkedInAt)}</Badge> : <span className="text-fg-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.points}</td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'confirmed' && !r.checkedInAt && (
                    <Button variant="ghost" size="sm" onClick={() => void cancel(r.id, r.participantName)}>
                      Cancelar<span className="sr-only"> inscrição de {r.participantName}</span>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
