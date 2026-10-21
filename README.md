# EventPass

Gestão de eventos com React/Vite, Fastify e PostgreSQL. O monorepo mantém os contratos Zod em packages/shared. A versão serverless serve o frontend estático e encaminha /api para api/index.ts no mesmo domínio da Vercel.

Use Node 24 e PostgreSQL 17. Instale com npm ci e configure as variáveis de .env.example em .env, ignorado pelo Git. DATABASE_URL usa a conexão pooled da Neon. DATABASE_URL_UNPOOLED usa a conexão direta para migrações e administração. TEST_DATABASE_URL deve apontar para um banco exclusivo de testes, onde a suíte cria e remove apenas schemas aleatórios ep_test_*.

Execute npm run db:migrate antes de iniciar a aplicação. Migrações são versionadas e serializadas por advisory lock. Não são executadas no cold start nem durante o build da Vercel.

Crie o administrador com npm run admin:create, usando ADMIN_EMAIL, ADMIN_NAME e ADMIN_PASSWORD em ambiente seguro. A senha nunca deve ser fornecida em argumentos ou commitada. A redefinição de senha e a revogação das sessões existentes ocorrem na mesma transação.

Para desenvolvimento use npm run dev. Para verificação execute npm run typecheck, npm run lint, npm test, npm run build e npm run test:e2e. Os E2E usam Chromium em desktop e viewport mobile, através do adaptador serverless, contra dados isolados. O CI usa PostgreSQL descartável e não recebe credenciais da Neon.

## Publicação

Importe somente este repositório na Vercel, com a raiz do monorepo e vercel.json. Configure DATABASE_URL e WEB_ORIGIN no ambiente preview. O frontend não recebe conexão do banco nem credenciais administrativas. COOKIE_SECURE é obrigatório em produção. A integração Git pode publicar previews da branch após a autenticação da conta Vercel. Não habilite planos pagos.

As inscrições e alterações de capacidade são serializadas pelo bloqueio da linha do evento. Check-ins e pontuação usam uma transação única, com unicidade no banco. As sessões são armazenadas somente como hashes e têm expiração verificada em cada acesso. O rate limit é compartilhado via PostgreSQL.

## Dados e recuperação

npm run db:import-sqlite lê SQLITE_SOURCE em modo somente leitura e aceita apenas destino vazio. Preserva IDs, hashes, sessões, inscrições, check-ins e pontuação. Não altera nem apaga o arquivo SQLite original. Bancos existentes não são sobrescritos.

npm run db:backup exige BACKUP_FILE e BACKUP_KEY (32 bytes aleatórios em hexadecimal). O arquivo usa AES-256-GCM e é criado sem sobrescrever arquivos. Guarde a chave separada do backup. npm run db:restore exige BACKUP_FILE, BACKUP_KEY e RESTORE_CONFIRM=empty-database. A recuperação valida o conteúdo e aceita somente tabelas de destino vazias, dentro de uma transação.

O workflow Homolog database operations permite migração ou backup no ambiente homolog, usando secrets próprios do EventPass. Não há restore automático ou deploy manual executado pelo CI. Configure a proteção do ambiente e faça restaurações somente em um destino novo e vazio.
