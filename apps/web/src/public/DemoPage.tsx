import { Badge, Card } from '../components/ui';
import { Link } from '../router/router';

/**
 * Demonstração estática da jornada (evento -> inscrição -> ingresso -> check-in -> pontos).
 * Todos os dados são fictícios e definidos aqui no cliente: nenhuma chamada à API é feita
 * e nenhuma inscrição real é criada. Serve para o visitante entender o produto mesmo
 * quando não há eventos publicados.
 */

const evento = {
  titulo: 'Encontro de Tecnologia (exemplo)',
  quando: 'Sexta-feira, 20 de novembro de 2026, 19h',
  onde: 'Auditório Central',
  vagas: '32 de 80 vagas disponíveis',
  pontos: 10,
};

const ranking = [
  { rank: 1, nome: 'Ana S.', pontos: 40 },
  { rank: 2, nome: 'Bruno C.', pontos: 30 },
  { rank: 3, nome: 'Carla M.', pontos: 20 },
];

/** QR decorativo de exemplo: não é um ingresso válido e não deve ser escaneado. */
function FakeQr() {
  const cells = [
    '1111111001101111111',
    '1000001011011000001',
    '1011101010101011101',
    '1011101011101011101',
    '1011101000101011101',
    '1000001011001000001',
    '1111111010101111111',
    '0000000011100000000',
    '1101101110110110110',
    '0110010001001001101',
    '1010111101111010110',
    '0101000110100100101',
    '1111011011011011110',
    '0000000010100000000',
    '1111111011101011101',
    '1000001000110100100',
    '1011101011011010110',
    '1011101001001101101',
    '1011101010110101110',
    '1000001011001000001',
    '1111111010111011111',
  ];
  return (
    <svg viewBox="0 0 19 21" role="img" aria-label="QR Code de exemplo (fictício)" className="h-auto w-full">
      <rect width="19" height="21" fill="white" />
      {cells.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="black" /> : null,
        ),
      )}
    </svg>
  );
}

function Etapa({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`etapa-${n}`} className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div>
        <p className="text-sm font-semibold text-primary">Etapa {n}</p>
        <h2 id={`etapa-${n}`} className="mt-1 text-lg font-semibold">
          {titulo}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function DemoPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
        <p className="font-medium">Demonstração com dados fictícios</p>
        <p className="mt-1 text-fg-muted">
          Esta página mostra como o EventPass funciona sem criar nenhum evento ou inscrição real. Nada do que
          aparece aqui é salvo.
        </p>
      </div>

      <h1 className="mb-1 text-2xl font-bold">Como funciona</h1>
      <p className="mb-8 text-sm text-fg-muted">Da inscrição ao ponto no ranking, em quatro etapas.</p>

      <div className="grid gap-10">
        <Etapa n={1} titulo="Encontre um evento aberto">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold">{evento.titulo}</h3>
              <Badge tone="warning">Fictício</Badge>
            </div>
            <p className="mt-1 text-sm text-fg-muted">{evento.quando}</p>
            <p className="text-sm text-fg-muted">{evento.onde}</p>
            <p className="mt-3 text-sm text-success">{evento.vagas}</p>
          </Card>
        </Etapa>

        <Etapa n={2} titulo="Inscreva-se com nome e e-mail">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold">Inscrição</h3>
              <Badge tone="warning">Fictício</Badge>
            </div>
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-fg-muted">
                Nome completo
              </div>
              <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-fg-muted">
                E-mail
              </div>
              <div className="rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-primary-fg">
                Confirmar inscrição
              </div>
            </div>
            <p className="mt-3 text-xs text-fg-muted">
              O ingresso aparece na hora, com QR Code. Não é enviado e-mail: o link do ingresso é a entrada.
            </p>
          </Card>
        </Etapa>

        <Etapa n={3} titulo="Guarde o ingresso com QR Code">
          <Card className="text-center">
            <div className="flex items-start justify-between gap-3 text-left">
              <h3 className="text-base font-semibold">Ingresso — {evento.titulo}</h3>
              <Badge tone="warning">Fictício</Badge>
            </div>
            <p className="mt-1 text-left text-sm text-fg-muted">{evento.quando}</p>
            <div className="mx-auto mt-4 w-full max-w-40 rounded-lg bg-white p-3">
              <FakeQr />
            </div>
            <p className="mt-3 text-sm text-fg-muted">
              Dá para imprimir, salvar em PDF, guardar nos favoritos ou fazer captura de tela.
            </p>
          </Card>
        </Etapa>

        <Etapa n={4} titulo="Faça check-in e pontue no ranking">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold">Ranking de participação</h3>
              <Badge tone="warning">Fictício</Badge>
            </div>
            <p className="mt-1 text-xs text-fg-muted">
              Presença confirmada no dia vale {evento.pontos} pontos. Nomes aparecem abreviados.
            </p>
            <ol className="mt-4 space-y-2">
              {ranking.map((r) => (
                <li key={r.rank} className="flex items-center gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                    <span className="sr-only">Posição </span>
                    {r.rank}
                  </span>
                  <span className="flex-1">{r.nome}</span>
                  <span className="font-semibold tabular-nums">{r.pontos} pts</span>
                </li>
              ))}
            </ol>
          </Card>
        </Etapa>
      </div>

      <p className="mt-10 text-center text-sm">
        <Link href="/" className="text-primary underline">
          Ver eventos abertos
        </Link>
      </p>
    </div>
  );
}
