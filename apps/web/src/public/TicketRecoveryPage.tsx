import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Input } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { useRouter, Link } from '../router/router';

export function TicketRecoveryPage({ token }: { token?: string }) {
  const { navigate } = useRouter();
  const [slug, setSlug] = useState(() => new URLSearchParams(window.location.search).get('evento') ?? '');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      await api.requestTicketRecovery(slug, email);
      setMessage('Se houver inscrição elegível, enviaremos instruções para o e-mail informado.');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Não foi possível processar a solicitação.');
    } finally {
      setSending(false);
    }
  }

  async function confirmRecovery() {
    if (!token) return;
    setSending(true);
    setError(null);
    try {
      const next = await api.confirmTicketRecovery(token);
      navigate('/ingresso/' + next);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Não foi possível recuperar o ingresso.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">{token ? 'Confirmar recuperação' : 'Recuperar ingresso'}</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {token
            ? 'Confirmando, um novo QR Code será emitido e o ingresso anterior deixará de funcionar.'
            : 'Informe o evento e o e-mail utilizado na inscrição. Enviaremos um link temporário, caso haja uma inscrição elegível.'}
        </p>
        {error ? <Alert tone="danger" className="mt-4" title={error} /> : null}
        {message ? <Alert tone="info" className="mt-4" title={message} /> : null}
        {token ? (
          <Button className="mt-5 w-full" type="button" onClick={() => void confirmRecovery()} loading={sending}>
            Gerar novo ingresso
          </Button>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={(event) => void requestRecovery(event)}>
            <Input name="slug" label="Identificador do evento" value={slug} onChange={(e) => setSlug(e.target.value)} required />
            <Input name="email" label="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" className="w-full" loading={sending}>Solicitar recuperação</Button>
          </form>
        )}
      </Card>
      <p className="mt-6 text-center text-sm"><Link href="/" className="text-primary underline">Voltar aos eventos</Link></p>
    </div>
  );
}
