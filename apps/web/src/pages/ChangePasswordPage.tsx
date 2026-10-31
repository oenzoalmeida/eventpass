import { useState, type FormEvent } from 'react';
import { changePasswordRequestSchema } from '@eventpass/shared';
import { Button, Card, CardDescription, Input } from '../components/ui';
import { useAuth } from '../auth/useAuth';
import { ApiRequestError } from '../lib/api';

type FieldErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>;

export function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = changePasswordRequestSchema.safeParse(data);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({
        currentPassword: f.currentPassword?.[0],
        newPassword: f.newPassword?.[0],
      });
      return;
    }
    if (data.confirmPassword !== parsed.data.newPassword) {
      setErrors({ confirmPassword: 'As senhas não coincidem.' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await changePassword(parsed.data);
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError ? err.message : 'Não foi possível trocar a senha agora.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col pt-12">
      <Card>
        <h1 className="text-xl font-semibold text-fg">Defina sua nova senha</h1>
        <CardDescription>
          Por segurança, a senha temporária precisa ser trocada antes de usar o painel.
        </CardDescription>
        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          {formError && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <Input
            name="currentPassword"
            type="password"
            label="Senha temporária"
            autoComplete="current-password"
            required
            error={errors.currentPassword}
          />
          <Input
            name="newPassword"
            type="password"
            label="Nova senha (mín. 12 caracteres)"
            autoComplete="new-password"
            required
            error={errors.newPassword}
          />
          <Input
            name="confirmPassword"
            type="password"
            label="Repita a nova senha"
            autoComplete="new-password"
            required
            error={errors.confirmPassword}
          />
          <Button type="submit" className="w-full" loading={submitting}>
            Salvar nova senha
          </Button>
        </form>
      </Card>
    </div>
  );
}
