# Migração: SQLite → PostgreSQL (Neon) e Fastify → Netlify Functions

Estado: **homologação**. A versão SQLite/servidor único continua no repositório
como referência e alternativa de recuperação (rollback). Nada foi publicado nem
migrado no banco `eventpass-homolog` sem autorização.

## Visão geral da arquitetura

```
apps/api/src/db/client.ts       Interface DbClient (get/all/run/lock/transaction)
apps/api/src/db/sqlite-client.ts  Implementação SQLite (node:sqlite) — referência
apps/api/src/db/pg.ts           Implementação PostgreSQL (postgres.js) p/ Neon
apps/api/migrations/            Esquema SQLite (original)
apps/api/migrations-pg/         Esquema PostgreSQL espelhado
apps/api/src/netlify.ts         Adaptador Request/Response → Fastify
apps/api/netlify/functions/     Function Netlify que atende /api/*
netlify.toml                    Build, redirect SPA e functions
```

- Mesmo código de rotas para os dois dialetos; SQL escrito em subset comum
  (`?` convertido para `$n` no Postgres).
- Concorrência: `transaction()` usa `BEGIN IMMEDIATE` no SQLite e
  `pg_advisory_xact_lock` no Postgres (método `lock()` da DbClient). A
  inscrição trava o evento e relê as vagas sob a trava; o check-in trava a
  inscrição — check-ins duplicados nunca pontuam duas vezes.
- Sessões ficam no banco: valem entre invocações e instâncias frias das
  Netlify Functions (rate limit é por instância; ver riscos).
- No Netlify a API não serve o frontend (`WEB_DIST` vazio): o SPA é entregue
  pela CDN e `/api/*` vai para a function.

## Variáveis (Netlify → Site settings → Environment variables)

| Variável            | Valor em homologação                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_DIALECT`  | `postgres`                                                                             |
| `DATABASE_URL`      | string de conexão do Neon (**pooler**, com `?sslmode=require`) — segredo, nunca no Git |
| `DATABASE_SSL`      | `true`                                                                                 |
| `COOKIE_SECURE`     | `true`                                                                                 |
| `SESSION_TTL_HOURS` | `12`                                                                                   |

Diferencial do SQLite local: nenhum além de `DATABASE_DIALECT/URL`.

## Migração dos dados (SQLite → Neon)

As migrações do schema rodam sozinhas na primeira conexão (`schema_migrations`).
Para copiar dados de um banco SQLite existente:

1. Autorize a escrita no branch `homolog` do Neon.
2. Com a API parada, exporte do SQLite:
   `sqlite3 eventpass.db ".mode json" "SELECT ..."` por tabela — ou use o script
   abaixo (esboço validado manualmente):
   ```bash
   npm run db:backup   # snapshot consistente do SQLite antes de tudo
   ```
3. Reinsira no Postgres respeitando a ordem das FKs:
   `admins → events → participants → registrations → checkins → point_entries → sessions`
   (sessões podem ser descartadas: os organizadores fazem login de novo).
4. Valide: `GET /api/admin/dashboard` deve bater com os totais do SQLite.

## Backup e restauração (Postgres/Neon)

- **Neon:** restore point-in-time de 7 dias no plano free (console → branch →
  History/Reset). Também é possível criar branch de backup.
- **pg_dump:** `pg_dump "$DATABASE_URL" -Fc -f eventpass-homolog.dump` e
  `pg_restore -d "$DATABASE_URL" --clean eventpass-homolog.dump`.
- **SQLite (referência):** `npm run db:backup` (VACUUM INTO + integrity_check).

## Rollback para a versão SQLite

1. Faça o dump do Neon (acima) se houver dados a preservar.
2. No Netlify, desative o site ou remova as variáveis `DATABASE_*` — o deploy
   volta a ser só o SPA (ou aponte para outra function).
3. Em qualquer servidor Node: `git checkout` da main, `npm install && npm run
build && npm run admin:create && npm start` com `DATABASE_DIALECT=sqlite`.
   O código da main não mudou; a main continua sendo a versão SQLite.
4. Se precisar dos dados do Neon: exporte em CSV/INSERTs e reinsira no SQLite
   na ordem das FKs.

## Instalação e builds reproduzíveis

O repositório **não versiona `package-lock.json`** (está no `.gitignore`).
Motivo: o lockfile gerado no Windows omite as dependências opcionais do Linux
(`@rollup/rollup-linux-x64-gnu` etc. — bug antigo do npm), o que já quebrou o
CI no Linux neste PR. Sem lockfile, o CI e a Netlify usam `npm install`, que
resolve os opcionais da plataforma correta. **Não troque por `npm ci`** sem
antes gerar um lockfile válido em Linux e comitá-lo.

Os ranges de versão são conservadores (`^` com patch/minor controlados pelo
`.nvmrc` Node 22 + CI verde), e a Netlify fixa o Node via `NODE_VERSION=22`.

## Testes

- `npm test` — suíte completa em SQLite (não depende de rede) + adaptador
  Netlify com SQLite em memória.
- `npm run test:pg` — integração Postgres real (concorrência, capacidade,
  check-in idempotente, sessões entre instâncias e o próprio adaptador
  Netlify conectado ao Postgres, provando que as migrações rodam antes do
  app). Requer `PG_TEST_DATABASE_URL` em banco descartável:
  ```bash
  docker run -d --name eventpass-pg-test -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
  PG_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres PG_TEST_SSL=false npm run test:pg
  ```
  Localmente sem Postgres os testes PG são pulados automaticamente.

### PG obrigatório na homologação

O CI tem um job `postgres` que roda `npm run test:pg` **sempre que a variável
de repositório `PG_TEST_DATABASE_URL` estiver definida** (Settings → Variables
and secrets → Variables). Aponte para um branch Neon **descartável** (a suíte
trunca os dados a cada teste) — por exemplo `eventpass-homolog/ci`, criado e
destruído no console do Neon. Com a variável definida, o check de PG passa a
ser obrigatório para o merge. `PG_TEST_SSL` (padrão `true`) acompanha o TLS.

## Teste de carga local (10/30/50 vus)

```bash
npm run db:seed && npm run dev        # alvo local, nunca produção
node loadtest/loadtest.mjs http://127.0.0.1:3333 10
node loadtest/loadtest.mjs http://127.0.0.1:3333 30
node loadtest/loadtest.mjs http://127.0.0.1:3333 50
```

30 s por patamar; imprime throughput, taxa de erro e p50/p90/p99. Vagas
esgotadas (409) e rate limit (429) são contados como respostas válidas.

## Riscos conhecidos da homologação

1. **Rate limit em memória:** cada instância fria da function tem seu próprio
   contador. Com eventos de 50–100 participantes o impacto é pequeno (o limite
   de login é por IP e as tentativas precisam vir do mesmo IP).
2. **`pg_advisory_xact_lock` com prepared statements desligados:** validado nos
   testes; se trocar de driver, rever.
3. **Latência de conexão:** a primeira invocação fria abre conexões com o Neon
   (região). Mantenha a function e o projeto Neon na mesma região.
4. **Datas como texto ISO:** o schema PG espelha o SQLite (TEXT). `ORDER BY` e
   comparações funcionam por prefixo ISO; não misture fusos.
