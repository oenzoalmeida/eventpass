# EventPass: ativação de notificações

## Estado
Código em branch de desenvolvimento. Nunca ativar em produção sem autorização independente, cópia de segurança, validação de migrações e teste de restauração. Não habilitar o worker enquanto o envio não estiver pronto.

## Requisitos
- Domínio próprio com SPF/DKIM verificados no Resend, remetente verificado e API key de escopo mínimo.
- URLs públicas por HTTPS e endereço consistente entre e-mail, frontend e backend.
- Chave de criptografia independente de 32 bytes em base64 canônico, armazenada em sistema de segredos, nunca no Git.
- PostgreSQL ou SQLite persistente, com migrations 003 e 004 aplicadas em ambiente de testes primeiro.
- Ativar EMAIL_ENABLED=true somente após comprovar worker agendado, capacidade do provedor e política de privacidade.
- Ativar TICKET_RECOVERY_ENABLED=true somente após teste de recuperação por e-mail de teste.

## Configuração segura
Variáveis: EMAIL_ENABLED, TICKET_RECOVERY_ENABLED, EMAIL_PUBLIC_BASE_URL, EMAIL_ENCRYPTION_KEY, EMAIL_FROM, RESEND_API_KEY.

Deixar EMAIL_ENABLED=false e TICKET_RECOVERY_ENABLED=false em produção até a autorização. Nunca usar URL de preview em links reais.

## Oracle (modelo, não instalado)
O arquivo deploy/oracle/eventpass-email.service executa uma leva finita com o mesmo usuário e banco da API. O timer correspondente executa a cada minuto. Eles são exemplos de systemd e **não são habilitados automaticamente**. Secrets em /etc/eventpass/email.env com permissão restrita ao administrador do sistema (e disponível ao serviço somente por EnvironmentFile). Revisar diretórios e executável npm antes de instalar.

## Netlify/Neon
Não usar timers systemd nem processos persistentes em Netlify Functions. O worker agendado separado está implementado nesta branch, mas não foi publicado nem habilitado. Exige limite de tempo e conexão pooler.

## Testes obrigatórios antes do rollout
- npm ci; npm run typecheck; npm run lint; npm test; npm run build.
- Teste PostgreSQL com PG_TEST_DATABASE_URL apontando para banco **descartável**.
- Falha de Resend, timeout, idempotência, expiração, corrida de 2 workers e cancelamento de ingresso.
- Teste de envio real somente para endereços controlados de teste, com aprovação explícita.
- Confirmar que nenhum token aparece em logs do app, proxy, rastreamento, relatórios ou sistemas de suporte.
- Conferir isolamento de dados e políticas LGPD.
- Testar rollback desabilitando as duas flags e suspendendo o timer, sem desfazer migração.

## Restrições
Nunca enviar e-mails do ambiente de CI com credenciais reais. Não publicar chaves, dados de destinatários, links de ingresso ou tokens em logs, repositório e artefatos de testes.

O Resend armazena chaves de idempotência por aproximadamente 24 horas. A outbox mantém chave de envio estável, mas a entrega exatamente uma vez não é garantida quando há falha de rede após aceite do provedor ou retomada muito tardia.

## Netlify Scheduled Function (implemented, disabled by default)

The feature branch now includes `apps/api/netlify/functions/email-queue.ts`, which Netlify builds as a scheduled function with cron `*/5 * * * *` (UTC). It calls the same bounded worker used by the Oracle CLI, processing up to one queued job per invocation with a 5-second provider timeout, 3-second connection timeout, 1-second statement/lock timeouts and a pre-send 15-second budget guard. The handler returns without opening a database if `EMAIL_ENABLED` is not explicitly `true`.

Netlify's official documentation states scheduled functions run automatically only on **published deploys**, not on previews, and have a 30-second execution limit. Retention must run separately through `npm run email:prune -w @eventpass/api` (no delivery, and no provider credentials required); the scheduled invocation skips pruning to preserve its delivery budget. Run maintenance at least daily in an approved environment with `DB_AUTO_MIGRATE=false`; no maintenance schedule is installed by this change. At one job per five minutes the theoretical ceiling is 288 attempts/day, but the Resend Free allowance is only 100 emails/day and 3,000/month. Plan volume before enabling; this is not a quota bypass. The batch size is deliberately small; actual sending throughput, provider quotas and billing must be checked before rollout. The worker requires PostgreSQL and a complete, migrated schema. Branch deploys do not constitute an automatic scheduled-delivery test.

No real Resend credentials were configured or used. Enabling the feature requires verifying DNS, the authorized domain, rate limits, billing, retry visibility and credentials in Netlify's protected environment settings. Do not place secrets in GitHub Actions or source files.
