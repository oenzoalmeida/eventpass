import { useState, type FormEvent } from 'react';
import { loginRequestSchema } from '@eventpass/shared';
import { Button, Card, CardDescription, Input } from '../components/ui';
import { useAuth } from '../auth/useAuth';
import { ApiRequestError } from '../lib/api';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export function LoginPage() {
  const { login } = useAuth();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = loginRequestSchema.safeParse(data);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data);
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Não foi possível entrar agora.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col pt-12">
      <Card>
        <h1 className="text-xl font-semibold text-fg">Entrar no painel</h1>
        <CardDescription>Acesso restrito a organizadores.</CardDescription>
        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          {formError && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <Input
            name="email"
            type="email"
            label="E-mail"
            autoComplete="username"
            required
            error={errors.email}
          />
          <Input
            name="password"
            type="password"
            label="Senha"
            autoComplete="current-password"
            required
            error={errors.password}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
