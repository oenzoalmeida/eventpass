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
Não usar timers systemd nem processos persistentes em Netlify Functions. Um worker agendado separado é necessário para o processamento, com limite de tempo e conexão pooler; não foi criado nesta branch.

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
