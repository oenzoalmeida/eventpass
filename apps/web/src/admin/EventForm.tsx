import { useState, type FormEvent } from 'react';
import { eventInputSchema, type AdminEvent, type EventInput } from '@eventpass/shared';
import { Alert, Button, Input, Textarea } from '../components/ui';
import { ApiRequestError } from '../lib/api';
import { fromLocalInput, toLocalInput } from '../lib/format';

type Errors = Partial<Record<keyof EventInput | 'form', string>>;

export function EventForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: AdminEvent;
  submitLabel: string;
  onSubmit: (data: EventInput) => Promise<void>;
}) {
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const raw = {
      title: String(f.get('title') ?? ''),
      description: String(f.get('description') ?? ''),
      location: String(f.get('location') ?? ''),
      startsAt: fromLocalInput(String(f.get('startsAt') ?? '')),
      endsAt: fromLocalInput(String(f.get('endsAt') ?? '')),
      capacity: f.get('capacity') === '' ? undefined : Number(f.get('capacity')),
      checkinPoints: f.get('checkinPoints') === '' ? undefined : Number(f.get('checkinPoints')),
    };
    const parsed = eventInputSchema.safeParse(raw);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) as Errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      if (err instanceof ApiRequestError && err.issues) {
        setErrors({
          form: err.message,
          ...Object.fromEntries(Object.entries(err.issues).map(([k, v]) => [k, v[0]])),
        });
      } else {
        setErrors({ form: err instanceof Error ? err.message : 'Não foi possível salvar.' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handle} noValidate className="max-w-2xl space-y-5">
      {errors.form && <Alert tone="danger" title={errors.form} />}
      <Input name="title" label="Título" required defaultValue={initial?.title} error={errors.title} maxLength={120} />
      <Textarea
        name="description"
        label="Descrição"
        defaultValue={initial?.description}
        error={errors.description}
        hint="Aparece na página pública de inscrição."
      />
      <Input name="location" label="Local" defaultValue={initial?.location} error={errors.location} placeholder="Auditório, endereço ou link" />
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          name="startsAt"
          type="datetime-local"
          label="Início"
          required
          defaultValue={initial ? toLocalInput(initial.startsAt) : undefined}
          error={errors.startsAt}
        />
        <Input
          name="endsAt"
          type="datetime-local"
          label="Término"
          required
          defaultValue={initial ? toLocalInput(initial.endsAt) : undefined}
          error={errors.endsAt}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          label="Vagas"
          required
          defaultValue={initial?.capacity ?? 50}
          error={errors.capacity}
        />
        <Input
          name="checkinPoints"
          type="number"
          inputMode="numeric"
          min={0}
          label="Pontos por presença"
          defaultValue={initial?.checkinPoints ?? 10}
          error={errors.checkinPoints}
          hint="Creditados só após o check-in."
        />
      </div>
      <Button type="submit" loading={saving}>
        {submitLabel}
      </Button>
    </form>
  );
}
