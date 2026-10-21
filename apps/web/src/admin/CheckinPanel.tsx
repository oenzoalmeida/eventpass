import { useCallback, useRef, useState, type FormEvent } from 'react';
import type { AdminEvent, CheckinResult } from '@eventpass/shared';
import { Alert, Button, Input } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { formatTime } from '../lib/format';
import { QrScanner } from './QrScanner';

type Feedback =
  | { kind: 'ok'; result: CheckinResult }
  | { kind: 'repeat'; result: CheckinResult }
  | { kind: 'error'; message: string };

export function CheckinPanel({ event, onCheckin }: { event: AdminEvent; onCheckin: () => void }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<CheckinResult[]>([]);
  const manualRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(
    async (token: string) => {
      if (!token.trim()) return;
      setBusy(true);
      try {
        const result = await api.checkin(event.id, token);
        setFeedback({ kind: result.alreadyCheckedIn ? 'repeat' : 'ok', result });
        if (!result.alreadyCheckedIn) {
          setHistory((h) => [result, ...h].slice(0, 10));
          onCheckin();
        }
        navigator.vibrate?.(result.alreadyCheckedIn ? [80, 60, 80] : 120);
      } catch (err) {
        setFeedback({ kind: 'error', message: err instanceof ApiRequestError ? err.message : 'Falha ao registrar presença.' });
        navigator.vibrate?.([200, 100, 200]);
      } finally {
        setBusy(false);
      }
    },
    [event.id, onCheckin],
  );

  function onManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = manualRef.current?.value ?? '';
    void submit(value).then(() => {
      if (manualRef.current) manualRef.current.value = '';
      manualRef.current?.focus();
    });
  }

  if (event.status === 'draft') {
    return <Alert tone="warning" title="Publique o evento para registrar presenças." />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <QrScanner onScan={(v) => void submit(v)} paused={busy} />
        <form onSubmit={onManual} className="flex items-end gap-2">
          <div className="flex-1">
            <Input ref={manualRef} name="token" label="Código ou link do ingresso" autoComplete="off" />
          </div>
          <Button type="submit" loading={busy}>
            Confirmar
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {/* Região viva: leitores de tela anunciam cada resultado. */}
        <div aria-live="assertive" aria-atomic="true">
          {feedback?.kind === 'ok' && (
            <Alert tone="success" title={`Presença confirmada: ${feedback.result.participantName}`}>
              +{feedback.result.pointsAwarded} pontos · total {feedback.result.totalPoints}
            </Alert>
          )}
          {feedback?.kind === 'repeat' && (
            <Alert tone="warning" title={`${feedback.result.participantName} já fez check-in`}>
              Registrado às {formatTime(feedback.result.checkedInAt)}. Nenhum ponto novo foi lançado.
            </Alert>
          )}
          {feedback?.kind === 'error' && <Alert tone="danger" title={feedback.message} />}
        </div>

        <p className="text-sm text-fg-muted">
          <strong className="text-fg tabular-nums">{event.checkins}</strong> de{' '}
          <strong className="text-fg tabular-nums">{event.registrations}</strong> inscritos presentes.
        </p>

        {history.length > 0 && (
          <section aria-labelledby="recentes">
            <h3 id="recentes" className="mb-2 text-sm font-semibold">
              Últimos check-ins nesta sessão
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
              {history.map((h) => (
                <li key={h.checkedInAt + h.participantEmail} className="flex justify-between gap-3 px-3 py-2">
                  <span>{h.participantName}</span>
                  <span className="text-fg-muted tabular-nums">{formatTime(h.checkedInAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
