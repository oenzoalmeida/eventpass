import { useState } from 'react';
import { Alert, Button, Card, ErrorState, Loading } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { formatDateTime, formatRange } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link } from '../router/router';

export function TicketPage({ token }: { token: string }) {
  const { status, data: ticket, error, reload } = useAsync(() => api.ticket(token), [token]);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkFeedback('Link copiado. Guarde em um lugar seguro e não compartilhe com outras pessoas.');
    } catch {
      setLinkFeedback('Não foi possível copiar automaticamente. Salve esta página nos favoritos ou use a opção de imprimir.');
    }
  }

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
              <div className="mt-4 space-y-3 text-sm text-fg-muted">
                <p>
                  Apresente este QR Code na entrada. Não enviamos o ingresso por e-mail: este link é a sua
                  única forma de acessá-lo.
                </p>
                <p>Guarde o acesso nos favoritos, copie o link ou faça uma captura de tela. Não compartilhe com outras pessoas.</p>
                <div className="no-print flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
                    Copiar link do ingresso
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => window.print()}>
                    Imprimir ou salvar em PDF
                  </Button>
                </div>
                {linkFeedback ? <p role="status" className="text-sm text-fg-muted">{linkFeedback}</p> : null}
              </div>
            )}
          </>
        )}
      </Card>
      <p className="no-print mt-6 text-center text-sm">
        <Link href={`/e/${ticket.event.slug}`} className="text-primary underline">
          Ver página do evento
        </Link>
      </p>
    </div>
  );
}
