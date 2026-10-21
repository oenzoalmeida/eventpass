import { useState, type FormEvent } from 'react';
import { registrationInputSchema } from '@eventpass/shared';
import { Alert, Button, Card, ErrorState, Input, Loading } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { formatRange } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, useRouter } from '../router/router';

type Errors = Partial<Record<'name' | 'email' | 'form', string>>;

export function EventPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const { status, data: event, error, reload } = useAsync(() => api.publicEvent(slug), [slug]);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  if (status === 'loading') return <Loading />;
  if (status === 'error') {
    return error instanceof ApiRequestError && error.status === 404 ? (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h1 className="text-xl font-bold">Evento não encontrado</h1>
        <p className="mt-2 text-fg-muted">
          O link pode estar incorreto. <Link href="/" className="text-primary underline">Ver eventos abertos</Link>
        </p>
      </div>
    ) : (
      <ErrorState error={error} onRetry={reload} />
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = registrationInputSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ name: f.name?.[0], email: f.email?.[0] });
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const token = await api.register(slug, parsed.data);
      navigate(`/ingresso/${token}`);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors({ form: err.message, name: err.issues?.name?.[0], email: err.issues?.email?.[0] });
        if (err.code === 'sold_out' || err.code === 'registrations_closed') reload();
      } else {
        setErrors({ form: 'Não foi possível concluir a inscrição.' });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_360px]">
      <article>
        <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-fg-muted">Quando:</dt>
            <dd>{formatRange(event.startsAt, event.endsAt)}</dd>
          </div>
          {event.location && (
            <div className="flex gap-2">
              <dt className="text-fg-muted">Onde:</dt>
              <dd>{event.location}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="text-fg-muted">Pontos por presença:</dt>
            <dd>{event.checkinPoints}</dd>
          </div>
        </dl>
        {event.description && <p className="mt-6 whitespace-pre-line leading-relaxed">{event.description}</p>}
      </article>

      <Card className="self-start">
        <h2 className="text-lg font-semibold">Inscrição</h2>
        <p className="mt-1 text-sm text-fg-muted" aria-live="polite">
          {event.isOpen ? `${event.spotsLeft} de ${event.capacity} vagas disponíveis` : 'Inscrições encerradas'}
        </p>
        {event.isOpen ? (
          <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
            {errors.form && <Alert tone="danger" title={errors.form} />}
            <Input name="name" label="Nome completo" autoComplete="name" required error={errors.name} />
            <Input name="email" type="email" label="E-mail" autoComplete="email" required error={errors.email} />
            <Button type="submit" className="w-full" loading={sending}>
              Confirmar inscrição
            </Button>
            <p className="text-xs text-fg-muted">
              Você receberá um ingresso com QR Code. Guarde o link: ele é a sua entrada no evento.
            </p>
          </form>
        ) : (
          <Alert tone="info" className="mt-4" title={event.spotsLeft === 0 ? 'Vagas esgotadas' : 'Este evento não está recebendo inscrições'} />
        )}
      </Card>
    </div>
  );
}
