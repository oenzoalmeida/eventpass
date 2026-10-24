# Segurança e auditoria

Revisão feita ao concluir as etapas 2 a 8. Cada item indica onde está implementado e como é verificado.

## Autenticação e sessões

| Medida                                                                                                              | Onde                              | Verificação        |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------ |
| Senhas com scrypt (N=2¹⁷, r=8, p=1) e salt aleatório                                                                | `api/src/auth/password.ts`        | teste de login     |
| Custo do scrypt reduzido (`EP_SCRYPT_N`) só em teste; em produção a variável é ignorada e vale sempre o custo OWASP | `password.ts`, `vitest.config.ts` | `password.test.ts` |
| Backup consistente com `VACUUM INTO` + `integrity_check`, seguro com a API no ar (WAL)                              | `scripts/backup.ts`               | `backup.test.ts`   |
| Comparação em tempo constante (`timingSafeEqual`)                                                                   | `password.ts`                     | revisão            |
| Mesma resposta e mesmo custo para e-mail inexistente e senha errada                                                 | `routes/auth.ts` (hash fictício)  | `auth.test.ts`     |
| Limite de 10 tentativas de login a cada 15 min por IP                                                               | `routes/auth.ts`                  | `auth.test.ts`     |
| Token de sessão de 256 bits; o banco guarda só o SHA-256                                                            | `auth/sessions.ts`                | revisão            |
| Cookie `httpOnly`, `SameSite=Strict`, `Secure` em produção                                                          | `routes/auth.ts`, `env.ts`        | `auth.test.ts`     |
| Sessões expiram (padrão 12 h) e são limpas de hora em hora                                                          | `sessions.ts`, `app.ts`           | revisão            |
| Redefinir senha encerra as sessões do administrador                                                                 | `scripts/create-admin.ts`         | revisão            |
| Senha mínima de 12 caracteres, nunca passada como argumento de linha de comando                                     | `create-admin.ts`                 | revisão            |

## Autorização e entrada de dados

| Medida                                                                              | Onde                                     | Verificação          |
| ----------------------------------------------------------------------------------- | ---------------------------------------- | -------------------- |
| Todas as rotas `/api/admin/*` exigem sessão (hook por plugin)                       | `admin-events.ts`, `admin-attendance.ts` | testes de 401        |
| Validação de toda entrada com Zod no servidor                                       | `packages/shared`, rotas                 | testes de 400        |
| SQL só com parâmetros (`prepare(...).run(?)`), sem concatenação de dados            | todas as rotas                           | revisão              |
| Requisições que alteram dados precisam ser JSON, o que bloqueia CSRF por formulário | `app.ts`                                 | `auth.test.ts` (415) |
| CORS restrito a `WEB_ORIGIN`                                                        | `app.ts`                                 | revisão              |
| Rascunhos não aparecem nas rotas públicas                                           | `routes/public.ts`                       | `public.test.ts`     |

## Integridade e concorrência

| Medida                                                                     | Onde                  | Verificação                                     |
| -------------------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| `UNIQUE(event_id, participant_id)` contra inscrição duplicada              | `001_initial.sql`     | `database.test.ts`, `public.test.ts`            |
| E-mail sem diferenciar maiúsculas (`COLLATE NOCASE` + normalização)        | migração, schemas     | testes                                          |
| Vagas verificadas e inscrição gravada na mesma transação `BEGIN IMMEDIATE` | `routes/public.ts`    | teste com 6 inscrições simultâneas para 2 vagas |
| Um check-in por inscrição e um lançamento de pontos por check-in           | migração              | `database.test.ts`, `admin-attendance.test.ts`  |
| Pontos só existem ligados a um check-in (FK obrigatória)                   | migração              | revisão                                         |
| Check-in idempotente: ler o QR de novo não gera pontos                     | `admin-attendance.ts` | teste                                           |
| Ingresso de outro evento é recusado                                        | `admin-attendance.ts` | teste                                           |
| Capacidade não pode ser reduzida abaixo das inscrições confirmadas         | `admin-events.ts`     | teste                                           |
| Excluir só rascunhos sem inscrições; os demais são encerrados              | `admin-events.ts`     | teste                                           |

## Privacidade

| Medida                                                                      | Onde               |
| --------------------------------------------------------------------------- | ------------------ |
| Token do ingresso de 192 bits, guardado só como hash; o link é a credencial | `lib/tickets.ts`   |
| Página do ingresso com `cache-control: no-store` e limite de requisições    | `routes/public.ts` |
| Ranking público mostra só o primeiro nome e a inicial do sobrenome          | `routes/public.ts` |
| A página pública não expõe e-mails nem listas de inscritos                  | `routes/public.ts` |
| Seed só com dados fictícios e bloqueado em produção                         | `scripts/seed.ts`  |
| `.env`, bancos `*.db` e a pasta `data/` fora do Git                         | `.gitignore`       |

## Navegador

| Medida                                                                                                                            | Onde                        |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Cabeçalhos do Helmet, incluindo uma Content-Security-Policy restritiva (`default-src 'self'`)                                     | `app.ts`                    |
| Script de tema em arquivo externo para funcionar sem `unsafe-inline`                                                              | `web/public/theme-init.js`  |
| `dangerouslySetInnerHTML` usado só para o SVG do QR, gerado pelo servidor a partir de um token aleatório, sem conteúdo do usuário | `TicketPage.tsx`            |
| CSV com proteção contra injeção de fórmulas (`=`, `+`, `-`, `@`)                                                                  | `lib/csv.ts`, `csv.test.ts` |

## Dialeto PostgreSQL (homologação)

| Medida                                                               | Onde                 | Verificação                 |
| -------------------------------------------------------------------- | -------------------- | --------------------------- |
| Mesma interface de consultas parametrizadas nos dois dialetos        | `db/client.ts`       | testes SQLite + PG          |
| Controle de vagas e check-in idempotente sob `pg_advisory_xact_lock` | `db/pg.ts`, rotas    | `pg.test.ts` (concorrência) |
| Sessões no banco persistem entre invocações serverless               | `auth/sessions.ts`   | `pg.test.ts`                |
| String de conexão só em variável de ambiente, nunca no Git           | `.env.example`, docs | revisão                     |

## Riscos aceitos e recomendações

1. **Rate limit em memória:** reinicia junto com o processo e não é compartilhado entre instâncias. Para várias instâncias, use um armazenamento compartilhado (Redis) no `@fastify/rate-limit`.
2. **IP atrás de proxy:** em produção, `trustProxy` está ligado para ler o IP real. Exponha a API **somente** através do proxy; se ela for acessível diretamente, um cliente pode falsificar `X-Forwarded-For` e driblar o limite de tentativas.
3. **Link do ingresso como credencial:** quem tiver o link vê o ingresso. É o mesmo modelo de ingressos impressos. Se o link vazar, cancele a inscrição e refaça-a para gerar um novo QR.
4. **Inscrição sem verificação de e-mail:** qualquer pessoa pode inscrever qualquer e-mail. O impacto se limita a ocupar uma vaga, que o organizador pode cancelar. A confirmação por e-mail é uma melhoria futura.
5. **Sem 2FA para administradores:** recomendado se houver muitos organizadores.
6. **Dependências:** rode `npm audit` periodicamente e ative o Dependabot no GitHub.
