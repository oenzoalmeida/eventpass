import { Alert, Card, ErrorState, Loading } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { formatDateTime, formatRange } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link } from '../router/router';

export function TicketPage({ token }: { token: string }) {
  const { status, data: ticket, error, reload } = useAsync(() => api.ticket(token), [token]);

  if (status === 'loading') return <Loading label="Carregando ingresso…" />;
  if (status === 'error') {
    return error instanceof ApiRequestError && error.status === 404 ? (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h1 className="text-xl font-bold">Ingresso não encontrado</h1>
        <p className="mt-2 text-fg-muted">Confira se o link foi copiado por inteiro.</p>
      </div>
    ) : (
      <ErrorState error={error} onRetry={reload} />
    );
  }

  const cancelled = ticket.status === 'cancelled';

  return (
    <div className="mx-auto max-w-md">
      <Card className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Ingresso</p>
        <h1 className="mt-1 text-xl font-bold">{ticket.event.title}</h1>
        <p className="mt-1 text-sm text-fg-muted">{formatRange(ticket.event.startsAt, ticket.event.endsAt)}</p>
        {ticket.event.location && <p className="text-sm text-fg-muted">{ticket.event.location}</p>}

        <p className="mt-5 font-medium">{ticket.participantName}</p>

        {cancelled ? (
          <Alert tone="danger" className="mt-4 text-left" title="Inscrição cancelada">
            Este ingresso não é mais válido.
          </Alert>
        ) : (
          <>
            {/* SVG gerado pelo nosso servidor a partir do token; não contém conteúdo do usuário. */}
            <div
              role="img"
              aria-label="QR Code do ingresso"
              className="mx-auto mt-4 w-full max-w-64 rounded-lg bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: ticket.qrSvg }}
            />
            {ticket.checkedInAt ? (
              <Alert tone="success" className="mt-4 text-left" title="Presença confirmada">
                Check-in em {formatDateTime(ticket.checkedInAt)}.
              </Alert>
            ) : (
              <p className="mt-4 text-sm text-fg-muted">
                Apresente este QR Code na entrada. Salve esta página nos favoritos ou faça uma captura de tela.
              </p>
            )}
          </>
        )}
      </Card>
      <p className="mt-6 text-center text-sm">
        <Link href={`/e/${ticket.event.slug}`} className="text-primary underline">
          Ver página do evento
        </Link>
      </p>
    </div>
  );
}
