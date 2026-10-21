import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardDescription, CardTitle, Input } from '../components/ui';
import { fetchHealth } from '../lib/api';

type ApiState = 'checking' | 'online' | 'offline';

const swatches = [
  ['bg-bg', 'Fundo'],
  ['bg-surface', 'Superfície'],
  ['bg-surface-muted', 'Superfície suave'],
  ['bg-primary', 'Primária'],
  ['bg-success', 'Sucesso'],
  ['bg-warning', 'Alerta'],
  ['bg-danger', 'Erro'],
] as const;

/** Vitrine temporária do design system; será substituída pelo dashboard na etapa 4. */
export function DesignSystemPage() {
  const [api, setApi] = useState<ApiState>('checking');

  useEffect(() => {
    const ctrl = new AbortController();
    fetchHealth(ctrl.signal)
      .then(() => setApi('online'))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setApi('offline');
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="space-y-8">
      <section aria-labelledby="status-title" className="flex flex-wrap items-center gap-3">
        <h2 id="status-title" className="text-sm font-medium text-fg-muted">
          Status da API
        </h2>
        {api === 'checking' && <Badge>Verificando…</Badge>}
        {api === 'online' && <Badge tone="success">Online</Badge>}
        {api === 'offline' && <Badge tone="danger">Offline</Badge>}
      </section>

      <section aria-labelledby="cores-title">
        <h2 id="cores-title" className="mb-3 text-lg font-semibold">
          Cores
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {swatches.map(([cls, name]) => (
            <li key={cls} className="text-sm">
              <div className={`h-14 rounded-lg border border-border ${cls}`} />
              <span className="mt-1 block text-fg-muted">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="botoes-title">
        <h2 id="botoes-title" className="mb-3 text-lg font-semibold">
          Botões
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button>Publicar evento</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="ghost">Ver detalhes</Button>
          <Button variant="danger">Excluir</Button>
          <Button loading>Salvando</Button>
        </div>
      </section>

      <section aria-labelledby="form-title" className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle id="form-title">Formulário</CardTitle>
          <CardDescription>Campos com rótulo, dica e erro acessíveis.</CardDescription>
          <form className="mt-4 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <Input label="Nome completo" placeholder="Maria Silva" required />
            <Input label="E-mail" type="email" hint="Usaremos para enviar seu QR Code." />
            <Input label="Telefone" error="Informe um telefone válido." defaultValue="123" />
            <Button type="submit">Inscrever-se</Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Evento de exemplo</CardTitle>
          <CardDescription>Workshop de React · 12 de novembro · Auditório 2</CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="primary">Publicado</Badge>
            <Badge tone="warning">Poucas vagas</Badge>
            <Badge tone="success">42 check-ins</Badge>
          </div>
        </Card>
      </section>
    </div>
  );
}
