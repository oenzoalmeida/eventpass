# Migração EventPass: Vercel + Neon

Status: **em planejamento técnico; migração não implementada nem publicada**.

## Inventário confirmado no código

- React/Vite em `apps/web`, Fastify em `apps/api`.
- Banco `node:sqlite` síncrono, com migrações SQL em `apps/api/migrations`.
- `buildApp(env, db)` injeta banco síncrono em todas as rotas.
- `transaction()` usa `BEGIN IMMEDIATE`, garantindo serialização de inscrições e check-ins.
- `setInterval` remove sessões expiradas; isso não deve ser usado como mecanismo de manutenção em funções efêmeras.
- `@fastify/static` serve a interface no processo Node atual; na Vercel, o frontend será servido como build estático.

## Plano de implementação

1. **Camada de dados PostgreSQL:** adicionar driver com pool apropriado para serverless; converter operações para `async`; criar interface de repositórios e adaptar consultas de eventos, inscrições, autenticação, check-in e relatórios. Não usar conversão automática cega de SQL.
2. **Migrações PostgreSQL:** criar esquema separado e versionado, com chaves, FKs, UNIQUE e CHECK equivalentes. Substituir `COLLATE NOCASE` por índice único de e-mail normalizado (ou `citext`) e validar datas/timestamps e IDs retornados com `RETURNING`.
3. **Concorrência:** reservar vaga sob bloqueio transacional de linha do evento (`SELECT ... FOR UPDATE`) antes de contar inscrições e inserir. Preservar restrição de inscrição única, check-in único e pontos únicos; testar 6 inscrições simultâneas para 2 vagas.
4. **Sessões e limites:** sessões permanecem no PostgreSQL; substituir rate limit em memória por mecanismo compartilhado compatível com funções serverless ou por proteção de borda adequada. Não confiar em IP de cabeçalhos não verificados.
5. **API serverless:** expor handler Fastify compatível com Vercel, sem `listen()` nem `setInterval`; manter cookies seguros, origem permitida e rotas administrativas protegidas.
6. **Frontend:** configurar build Vite e rewrites para `/api/*` e rotas SPA, com chamadas de mesma origem. Não enviar `DATABASE_URL` para o bundle do navegador.
7. **CI:** rodar lint, typecheck, build e testes com PostgreSQL descartável; adicionar testes de concorrência, rollback, autorização, check-in idempotente, ranking e CSV.
8. **Homologação:** criar projeto Neon separado apenas após conferir cota e plano; conectar segredos na Vercel; implantar preview; executar testes ponta a ponta e revisar política de uso Hobby antes de produção.

## Bloqueios para deploy

- Confirmar cotas e elegibilidade de projeto gratuito no Neon.
- Confirmar consumo e enquadramento do plano Vercel.
- Concluir implementação e CI; **não apontar tráfego público para um banco parcialmente migrado**.
- Definir estratégia de backup e restauração do PostgreSQL, privacidade e retenção de dados.
- Se já houver dados reais no SQLite, planejar exportação e importação com validação de contagens, relações e integridade. Não presumir banco vazio.

## Critério de aceite

Nenhum merge ou deploy de produção antes de todos os fluxos e testes críticos passarem com PostgreSQL real. Preservar o backend SQLite existente na `main` até a homologação.

## Progresso de implementação

- [x] Esquema inicial PostgreSQL em `apps/api/migrations-postgres/001_initial.sql`, com integridade relacional, e-mails case-insensitive e unicidade de check-ins e pontos.
- [ ] Executar migração contra banco PostgreSQL descartável e validar DDL.
- [ ] Adaptar API e testes para operações assíncronas.

**Atenção:** o esquema ainda não é executado pela aplicação e não foi validado em banco PostgreSQL. Não rodar em produção.
