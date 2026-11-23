# EventPass: comunicação transacional e recuperação de ingressos

## Estado da implementação
A integração está desenvolvida na branch `feat/email-notification-foundation`, mas permanece **desabilitada por padrão**, sem credenciais reais, sem modificações na produção e sem atualização do design system. O uso real depende da lista de liberação em `docs/EMAIL-ROLLOUT.md`.

## Componentes
- `apps/api/src/lib/email/content.ts`: templates HTML e texto produzidos com React Email e renderizados apenas no backend.
- `apps/api/src/lib/email/crypto.ts`: AES-256-GCM, nonce aleatório e AAD por idempotencyKey. A chave de 32 bytes não pertence ao Git.
- `apps/api/src/lib/email/outbox.ts`: fila transacional persistente com controle de lease, retries com backoff e idempotência no banco. Payloads são eliminados após confirmação de envio ou falha terminal.
- `apps/api/src/lib/email/resend-provider.ts`: adaptador opt-in para Resend com cabeçalho Idempotency-Key e timeout. `MemoryEmailProvider` é usado nos testes.
- `apps/api/src/scripts/process-email.ts`: processador de lote manual (até 20 mensagens), validando elegibilidade do ingresso e do pedido de recuperação antes de enviar.
- `apps/api/src/routes/ticket-recovery.ts`: solicitação com resposta genérica e link de uso único; confirmação cria novo token e invalida o anterior.
- `apps/web/src/public/TicketRecoveryPage.tsx`: página utilizando componentes já existentes.
- `apps/api/migrations/003_email_outbox.sql` e `004_ticket_recovery.sql`: versões SQLite e PostgreSQL.

## Comportamento
A inscrição mantém o contrato atual e devolve o ingresso imediatamente. Quando `EMAIL_ENABLED=true`, registra tarefa da outbox **na mesma transação da inscrição**. Nenhuma requisição HTTP ao Resend ocorre dentro dessa transação.

A recuperação só funciona com `EMAIL_ENABLED=true` e `TICKET_RECOVERY_ENABLED=true`. O pedido público não revela se o destinatário existe. Tokens temporários expiram em 15 minutos e são armazenados apenas como hash. A confirmação exige token válido e emite um novo ingresso, revogando o anterior sem criar inscrição extra ou conceder pontos.

A fila só é processada quando o operador executar explicitamente o worker ou instalar uma tarefa agendada aprovada. Nenhum timer de envio é ativado automaticamente.

## Limitações e riscos conhecidos
- O envio exatamente uma vez não pode ser garantido com provedor externo. O Resend conserva idempotency keys durante 24 horas; tempos de entrega e falhas ambíguas exigem observabilidade.
- A limitação de requisições Fastify é local a cada instância. A solicitação de recuperação tem limite adicional por inscrição no banco (3 pedidos/hora), mas a proteção distribuída por IP precisa de análise em arquitetura multi-instância.
- É preciso configurar domínio, DNS e identidade remetente. Não usar chaves reais em CI, commits ou logs.
- URLs de ingresso e de recuperação são credenciais. Infraestrutura externa (proxy, monitoramento e entrega de e-mail) também precisa suprimir esses caminhos de logs.
- A tabela de fila guarda endereço de e-mail pessoal em claro, por isso exige política de retenção, controle de acesso e limpeza periódica antes de produção.
- A rotação da chave `EMAIL_ENCRYPTION_KEY` deve considerar mensagens pendentes. A criptografia atual usa envelope v1, com uma chave ativa.
- O processo Oracle usa um timer systemd de exemplo em `deploy/oracle`, mas não foi instalado nem ativado. Netlify exige agendamento adaptado à plataforma e não usa esses arquivos.

## Testes previstos
`npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e `npm run test:pg` com PostgreSQL **descartável**. A automação do CI executa a suíte em cada push na branch.

## Segurança operacional
As flags ficam desligadas por padrão e não alteram o fluxo existente. Não habilitar envio sem acesso a logs filtrados, controle de volume diário, monitoramento de retries, política de retenção e um ensaio de backup/restauração.
