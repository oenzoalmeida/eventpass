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
| `DB_AUTO_MIGRATE`   | não definir (produção não altera schema; aplique com `npm run db:migrate`)             |

Diferencial do SQLite local: nenhum além de `DATABASE_DIALECT/URL`.

## Migração dos dados (SQLite → Neon)

Em produção, as migrações **não** são aplicadas automaticamente. Execute `npm run db:migrate` explicitamente no banco de homologação, após conferir o destino e criar um backup. Em desenvolvimento/teste, a aplicação pode aplicar migrações na primeira conexão (`schema_migrations`).
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
- **pg_dump:** use uma conexão direta com permissões mínimas para exportar um backup consistente: `pg_dump "$BACKUP_DATABASE_URL" -Fc -f eventpass-homolog.dump`.
- **Teste de restauração:** restaure **somente em um banco descartável e isolado**, usando `pg_restore --dbname="$RESTORE_TEST_DATABASE_URL" --no-owner --no-acl eventpass-homolog.dump`. Verifique tabelas, contagens e fluxos críticos antes de considerar o backup recuperável. Nunca use a URL do banco de produção ou homologação como `RESTORE_TEST_DATABASE_URL`; não execute `pg_restore --clean` em bancos ativos.
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

O `package-lock.json` **é versionado** (lockfile v3, gerado com npm 11), com
as dependências opcionais de todas as plataformas registradas (incluindo
`@rollup/rollup-linux-x64-gnu`). O CI e a Netlify instalam com **`npm ci`**
(build da Netlify: `npm ci && npm run build`), garantindo o mesmo resultado no
Linux a partir de qualquer sistema operacional.

Se um dia precisar regenerar o lockfile, use npm ≥ 10.5 e confira que os
opcionais do Linux continuam presentes (`@rollup/rollup-linux-*` em
`package-lock.json`) — lockfiles antigos gerados no Windows omitiam esses
opcionais e quebravam `npm ci` no Linux.

## Migrações na inicialização

- Fora de produção (`development`/`test`), `openDb` aplica migrações
  pendentes automaticamente na inicialização (servidor e Netlify Function).
- Em produção (`NODE_ENV=production`), **nada é alterado no schema sem ordem
  explícita**: o padrão é `DB_AUTO_MIGRATE=false` e a inicialização apenas
  **verifica** se o banco está na versão do código — se faltar migração, o
  processo falha com instrução clara em vez de migrar em silêncio.
- Para aplicar migrações no banco de homologação, rode explicitamente:
  ```bash
  DATABASE_DIALECT=postgres DATABASE_URL='<string do branch homolog>' npm run db:migrate
  ```
  Não habilite `DB_AUTO_MIGRATE=true` no deploy de produção para contornar essa etapa.
- Comportamento coberto por teste: em produção com banco desatualizado, a
  inicialização recusa sem tocar no schema.

## Testes

- `npm test` — suíte completa em SQLite (não depende de rede) + adaptador
  Netlify com SQLite em memória.
- `npm run test:pg` — integração Postgres real (concorrência, capacidade,
  check-in idempotente, sessões entre instâncias, o adaptador Netlify
  conectado ao Postgres e a guarda de migrações em produção). Requer
  `PG_TEST_DATABASE_URL` em banco descartável:
  ```bash
  docker run -d --name eventpass-pg-test -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
  PG_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres PG_TEST_SSL=false npm run test:pg
  ```
  Localmente sem Postgres os testes PG são pulados automaticamente.

### PG obrigatório no CI

O workflow de CI tem um job `postgres` que **sempre** roda `npm run test:pg`
sobre um serviço **Postgres 16 descartável do próprio GitHub Actions** (container
`services`, truncado a cada teste — nenhum banco real é usado). O job integra
os checks do PR: com a proteção de branch exigindo todos os checks, falha de
PostgreSQL **bloqueia o merge**. (Se a proteção de `main` não estiver ativa,
ative-a exigindo os jobs `check` e `postgres`.)

## Estimativa de consumo nos planos gratuitos (out/2026)

Valores dos sites oficiais em outubro de 2026 — confira antes de decidir:

- **Netlify Free — modelo por créditos:** 300 créditos/mês (sem cobrança
  automática além disso; quando acabam, os deploys param até o ciclo seguinte).
  Consumo informado: deploy de produção ≈ 15 créditos, banda ≈ 20 créditos/GB,
  requisições web ≈ 2 créditos/10 mil. Para o EventPass: ~20 deploys/mês +
  tráfego de eventos de 50–100 participantes fica bem abaixo dos 300 crédits.
- **Neon Free:** 1 GB de armazenamento por projeto (20 GB na conta), 100
  CU-hours de compute por projeto/mês, autosuspend após 5 min (scale to zero,
  ideal para funções), até 2 CU. O banco do EventPass cabe em poucos MB e o
  compute por requisição é de milissegundos — a homologação usa uma fração
  mínima das 100 CU-hours.

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

## Estado da homologação (out/2026)

Site Netlify criado e publicado: **https://incomparable-panda-7984de.netlify.app**
(id `e7bc4548-6a98-4d4a-b9ab-ca4929f719d1`, conta `oenzoalmeida`, plano Free).
Deploy feito pelo script `scripts/deploy-homolog.mjs` (pacote autocontido, via
CLI). Variáveis já configuradas no site: `DATABASE_DIALECT=postgres`,
`DATABASE_SSL=true`, `COOKIE_SECURE=true`.

### Ações manuais indispensáveis (dependem de login interativo)

1. **Tornar o site público** — novos sites Netlify nascem com visibilidade
   restrita e respondem 401 para visitantes. Netlify UI → projeto
   `incomparable-panda-7984de` → Project configuration → General →
   Visitor access → Project visibility → **Public** → Save.
   Não existe API/CLI para esse ajuste (confirmado pela documentação oficial).
2. **Reautenticar o Neon** — o token local expirou. Rode `npx neonctl auth`
   (abre o navegador). Depois, no console do Neon, projeto
   `eventpass-homolog`, branch `homolog`, copie a connection string
   (host terminado em `-pooler`).
3. **Definir `DATABASE_URL` no site** — `netlify env:set DATABASE_URL '<string>'`
   (ou pela UI). É segredo: nunca em commits, logs ou relatórios.
4. **Migrar o banco de homologação** — só depois de conferir no console que o
   branch está vazio (sem tabelas): `DATABASE_DIALECT=postgres
DATABASE_URL='<string>' npm run db:migrate`. A function NÃO migra sozinha
   em produção (DB_AUTO_MIGRATE=false).
5. **Criar admin de teste** — mesmas variáveis acima mais
   `ADMIN_EMAIL`/`ADMIN_NAME`/`ADMIN_PASSWORD` (senha forte) e
   `npm run admin:create`.
6. **Deploy automático** — crie um Personal access token no Netlify
   (User settings → Applications → New token) e cadastre como secret
   `NETLIFY_AUTH_TOKEN` no repositório GitHub. O workflow
   `deploy-homolog.yml` publica a cada push da branch (sem ele, o workflow
   passa com um aviso de deploy pulado). `NETLIFY_SITE_ID` é opcional:
   o default já aponta para o site de homologação.

### Validação pós-configuração

```bash
curl https://incomparable-panda-7984de.netlify.app/api/health   # {"status":"ok",...}
# login, criação de evento, inscrição, ingresso, check-in e relatório pela UI
```

## E2E da homologação (validado localmente com a function real)

A function publicada pela Netlify é um bundle CJS gerado pelo
zip-it-and-ship-it — diferente do código executado nos testes comuns. A
validação abaixo roda exatamente o artefato de produção:

```bash
# 1. Banco local descartável + migrações + admin fictício
docker run -d --name eventpass-pg-test -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
DATABASE_DIALECT=postgres DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres \
  DATABASE_SSL=false npm run db:migrate
ADMIN_EMAIL=admin.homolog@test.local ADMIN_NAME='Admin Homolog' \
  ADMIN_PASSWORD='<senha forte>' npm run admin:create

# 2. Bundle real (mesmo empacotador da Netlify) + servidor local
npm run build && node scripts/deploy-homolog.mjs --skip-publish  # ou monte .deploy-netlify
cd .deploy-netlify && npx @netlify/zip-it-and-ship-it functions built && unzip -o built/api.zip -d built-x
cd .. && NODE_ENV=production DATABASE_DIALECT=postgres \
  DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres \
  DATABASE_SSL=false COOKIE_SECURE=false node scripts/serve-function.mjs

# 3. Suíte E2E (30 verificações)
BASE_URL=http://localhost:8877 node scripts/e2e-homolog.mjs
```

Resultado (branch atual): **30 ok / 0 falhas** — login, cookie httpOnly+
SameSite=Strict, sessão persistente, 401 sem sessão, criação/publicação de
evento, 3 inscrições com 2 recusadas por lotes, ingresso com QR SVG, check-in
idempotente, pontuação única, relatório (ocupação/presença/pontos), CSV
pt-BR, ranking com nomes abreviados, cancelamento bloqueado pós check-in,
logout 204 e sessão invalidada.

Essa suíte encontrou dois bugs que só existiam no runtime serverless e
foram corrigidos: cold start quebrado por `fileURLToPath(import.meta.url)`
em bundle CJS, e respostas 204/304 inválidas no adaptador (logout/exclusão
falhariam com 500).

Para a homologação pública, o mesmo script roda contra a URL real:
`BASE_URL=https://<site>.netlify.app node scripts/e2e-homolog.mjs`.
