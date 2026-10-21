import { useState } from 'react';
import type { AdminEvent, EventStatus } from '@eventpass/shared';
import { Alert, Button, ErrorState, Loading } from '../components/ui';
import { EventStatusBadge } from '../components/EventStatusBadge';
import { Tabs } from '../components/Tabs';
import { api, ApiRequestError } from '../lib/api';
import { formatRange } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, useRouter } from '../router/router';
import { CheckinPanel } from './CheckinPanel';
import { EventForm } from './EventForm';
import { RegistrationsPanel } from './RegistrationsPanel';
import { ReportPanel } from './ReportPanel';

export function EventDetailPage({ id }: { id: number }) {
  const { navigate } = useRouter();
  const { status, data: event, error, reload, setData } = useAsync(() => api.event(id), [id]);
  const [tab, setTab] = useState('inscricoes');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState error={error} onRetry={reload} />;

  const publicUrl = `${window.location.origin}/e/${event.slug}`;

  async function changeStatus(next: EventStatus) {
    setActionError(null);
    try {
      setData(await api.setEventStatus(event!.id, next));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Não foi possível alterar a situação.');
    }
  }

  async function remove() {
    if (!window.confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return;
    try {
      await api.deleteEvent(event!.id);
      navigate('/admin/eventos');
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : 'Não foi possível excluir.');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copie o link:', publicUrl);
    }
  }

  const refresh = () => {
    void api.event(id).then(setData).catch(() => undefined);
  };

  return (
    <>
      <nav aria-label="Trilha" className="mb-2 text-sm">
        <Link href="/admin/eventos" className="text-fg-muted hover:text-fg">
          ← Eventos
        </Link>
      </nav>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {formatRange(event.startsAt, event.endsAt)}
            {event.location && ` · ${event.location}`}
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            {event.registrations}/{event.capacity} inscritos · {event.checkins} check-ins · {event.checkinPoints} pontos por presença
          </p>
        </div>
        <StatusActions event={event} onChange={changeStatus} onDelete={remove} />
      </div>

      {actionError && <Alert tone="danger" title={actionError} className="mb-4" />}

      {event.status !== 'draft' && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <span className="text-fg-muted">Página pública:</span>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all text-primary underline">
            {publicUrl}
          </a>
          <Button variant="ghost" size="sm" onClick={() => void copyLink()}>
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
        </div>
      )}

      <Tabs
        label="Seções do evento"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'inscricoes', label: 'Inscrições', content: <RegistrationsPanel event={event} onChange={refresh} /> },
          { id: 'checkin', label: 'Check-in', content: <CheckinPanel event={event} onCheckin={refresh} /> },
          { id: 'relatorio', label: 'Relatório', content: <ReportPanel event={event} /> },
          {
            id: 'editar',
            label: 'Editar',
            content: (
              <div className="space-y-4">
                {saved && <Alert tone="success" title="Alterações salvas." />}
                <EventForm
                  key={event.updatedAt}
                  initial={event}
                  submitLabel="Salvar alterações"
                  onSubmit={async (data) => {
                    setData(await api.updateEvent(event.id, data));
                    setSaved(true);
                  }}
                />
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

function StatusActions({ event, onChange, onDelete }: { event: AdminEvent; onChange: (s: EventStatus) => Promise<void>; onDelete: () => Promise<void> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {event.status === 'draft' && (
        <>
          <Button onClick={() => void onChange('published')}>Publicar</Button>
          {event.registrations === 0 && (
            <Button variant="ghost" onClick={() => void onDelete()}>
              Excluir
            </Button>
          )}
        </>
      )}
      {event.status === 'published' && (
        <Button
          variant="secondary"
          onClick={() => {
            if (window.confirm('Encerrar o evento? Novas inscrições serão bloqueadas.')) void onChange('closed');
          }}
        >
          Encerrar inscrições
        </Button>
      )}
      {event.status === 'closed' && (
        <Button variant="secondary" onClick={() => void onChange('published')}>
          Reabrir
        </Button>
      )}
    </div>
  );
}
