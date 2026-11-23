# EventPass, ensaio técnico de 23/nov/2026

## Base e limites

Base local: 510ba86b8c3b430e79f12900bf89cea8afd8b7a3, branch feat/email-notification-foundation. CI remoto mais recente conferido: https://github.com/oenzoalmeida/eventpass/actions/runs/45104929940, aprovado. Main remota: be13c337a21e2fbb02e4d012d8dffa0531d54e4f. Não houve push, PR publicado, deploy, envio real, alteração de plano, migração no banco ativo ou alteração AWS nesta rodada.

## Correções e evidências

- O pacote CLI incluía apenas api.ts. Agora inclui todas as funções TypeScript com caminhos adaptados. Regressão falha com o script antigo. Empacotador real @netlify/zip-it-and-ship-it gerou api.zip e email-queue.zip e reconheceu cron */5 * * * *.
- IDs bigint do PostgreSQL chegam como strings. O lock de '42' era diferente do lock de 42. Isso quebra o contrato entre IDs legados bigint e novas FKs integer. Normalização decimal corrigida; regressão PostgreSQL falha no código original e passa na correção.
- Links de e-mail rejeitam protocolos não HTTP(S) mesmo em localhost e credenciais embutidas.
- Validação de ambiente não devolve valores inválidos, que poderiam conter segredos.
- Testes adicionais: expiração, resgate concorrente de uso único, limite por inscrição e limite por IP.
- Atualização compatível do lockfile via npm audit fix sem --force. Auditoria de dependências de runtime zerada. Restam 12 moderados na cadeia de desenvolvimento Netlify; não houve downgrade automático sugerido por --force.

## Neon real, somente esquema

Projeto little-voice-72531404, banco eventpass, branch ativa homolog br-patient-wind-b86oqnp2 revalidada somente por metadados e nomes de migração. Mantém 001_initial.sql, 002_serverless.sql, 003_point_ownership.sql. IDs admins/registrations são bigint; coluna must_change_password e tabelas email_outbox/ticket_recovery_requests ausentes.

Criada cópia temporária schema-only tmp-email-schema-20261123, br-floral-union-b86d5tmd, sem copiar registros pessoais. Conferidos zero admins, participantes, inscrições e registros de migração. O histórico não acompanha a cópia schema-only: manifesto histórico foi reconstruído explicitamente para o ensaio, sem alegar preservação de linhas copiadas. Aplicados os SQL exatos 002_password_change, 003_email_outbox, 004_ticket_recovery em transação, seguidos dos seis nomes do manifesto. COMMIT, coluna e tabelas verificados. Branch ativa intacta.

Expiração automática: 24/nov/2026 08:12 America/Sao_Paulo. Plano Free, PostgreSQL 17, retenção observada 6 horas, não os 7 dias citados no documento antigo. Não foi executada a aplicação EventPass contra Neon nesta etapa. Em investigação adicional às09:09, o endpoint oficial GET connection_uri foi acessado pela sessão autenticada do console, com branch_id temporária explícita; retornou200 e a URI foi validada em memória da página (host/banco corretos e senha presente). Somente status/booleanos saíram desse contexto, sem URI/senha em logs. Não há transporte suportado dessa resposta até o processo local sem tornar o segredo saída de navegação. Logo, acesso à API de controle Neon existe; execução da API EventPass continua pendente de transporte seguro da conexão. São evidências diferentes dos testes locais e do DDL real.

## Netlify

Site e7bc4548-6a98-4d4a-b9ab-ca4929f719d1, incomparable-panda-7984de, equipe oenzoalmeida. Console: https://app.netlify.com/projects/incomparable-panda-7984de/overview . Site privado para publicado e previews, deploy CLI de 27/out, mensagem homolog, apenas função api. Sem ligação Git indicada no resumo. Variáveis presentes: COOKIE_SECURE, DATABASE_DIALECT, DATABASE_SSL, DATABASE_URL. Valores secretos não lidos. Não foram adicionadas flags ou chaves de e-mail.

Free, período 25/out a 24/nov, créditos normais esgotados. 28,2/30 créditos operacionais restantes até 24/nov, sites permanecem online, mas novos deploys publicados e Agent Runners pausados. Não presume necessidade de upgrade. Não houve tentativa de publicar.

Documentação oficial confirma cron UTC, 30s por execução e execução automática apenas em deploy publicado, não previews. Fonte: https://docs.netlify.com/build/functions/scheduled-functions/ . Scheduler reduzido a1job; timeout de conexão3s, statement/lock1s, provider5s, guarda antes de envio15s. Testes PostgreSQL locais validaram worker agendado com transporte simulado e timeout de consulta; adapter aborta transporte em teste. Isso reduz risco, não prova duração em infraestrutura Netlify real. Retenção movida para comando explícito separado sem envio; ainda precisa execução diária operacional autorizada. Nenhum cron de manutenção instalado.

## Resend

Sem sessão ou credencial específica disponível. Login GitHub pede novo OAuth para leitura de e-mails; não autorizado nesta rodada. Domínios, DNS, remetente e chaves da conta não verificados. Nenhum envio. Limite gratuito público consultado: 3.000/mês, 100/dia, https://resend.com/pricing . Destinatário simulado de teste do provedor não é prova de entrega em caixa real. Entrega real depende de acesso, remetente e autorização expressa de destinatário controlado.

## Testes locais finais e correções adicionais

- Node22.23.5 e rodada adicional isolada Node24.22.3 (typecheck,lint,build,API,web,PG aprovados). Isso não é validação de deploy Vercel24.x. PostgreSQL14.24 descartável. Não confundir com PostgreSQL17 do Neon.
- npm ci realizado; typecheck, lint, build e diff --check aprovados.
- API101 testes aprovados; web22 aprovados. Os11 testes PostgreSQL não são executados por npm test sem ambiente dedicado; foram executados separadamente e os11 passaram.
- API HTTP empacotada com PostgreSQL:30/30. Dump/restore da fixture com1admin,1evento,3inscrições e4migrações, seguido de30/30 HTTP no destino restaurado. Sem backup/restauração de dados reais.
- Worker real com HTTP simulado: renderiza, entrega uma vez, limpa ciphertext, retry de503 e bloqueio de inscrição cancelada. PostgreSQL inclui caminho agendado, bigint, rotação e check-in idempotente, claim concorrente por dois workers e resgate concorrente de uso único.
- Concorrência SQLite reproduziu BEGIN aninhado ao executar duas claims na mesma conexão. Regressão falhou antes e passou com fila de transações; liberação da fila após rollback também verificada. Um segundo ensaio reproduziu enqueue externo revertido junto com transação alheia; operações externas agora aguardam a fila e o callback usa client transacional dedicado, com regressão antes/depois.
- Logger de erro inesperado e limpeza de sessão não emite mais exceção bruta; regressão verifica ausência do conteúdo privado da exceção.
- Inspeção de pixels: home/login desktop, recuperação mobile390px, confirmação React Email desktop e recuperação React Email mobile. Sem alteração de estilos globais, identidade visual ou componentes existentes.
- Auditoria npm runtime:0vulnerabilidades.12moderadas continuam apenas na cadeia de ferramentas Netlify de desenvolvimento; não aplicar downgrade forçado sem avaliar.

## Gatilhos remotos e versionamento

A base está16commits à frente e0atrás da main observada. CI remoto aprovado continua relativo à base510ba86, não aos commits locais desta rodada. Nenhum PR aberto encontrado na consulta atual.

Vercel possui projeto eventpass-homolog com o repositório conectado, deploy Preview da branch de e-mail e política de build Automatic. Build npm run build, output apps/web/dist, install npm ci, Node24.x. Variáveis DATABASE_URL,WEB_ORIGIN,COOKIE_SECURE somente no escopo Production. Nenhum valor revelado. Push não é operação neutra: pode disparar preview. Publicação remota retida: a configuração Automatic foi lida e não existe prova de bloqueio de deploy para a nova branch. Sem alterar conta/configuração remota ou inserir controle de deploy revisado, não há push demonstravelmente sem efeito. Continua necessário isolar gatilho/ambiente e resolver autenticação específica sem reutilizar credenciais de outros projetos. Nenhuma configuração externa foi alterada.

- https://vercel.com/tech-lead1/eventpass-homolog/settings/git
- https://vercel.com/tech-lead1/eventpass-homolog/settings/build-and-deployment
- https://vercel.com/tech-lead1/eventpass-homolog/settings/environment-variables

Workflow Netlify no repositório só dispara push na feat/netlify-neon-homolog ou workflow_dispatch; CI dispara main,feat/email-notification-foundation e PR. Apps Render/Northflank instalados no GitHub não foram tratados como prova de projeto EventPass ativo. Não há garantia de ausência de todos os consumidores Git externos.

## Dependências que permanecem

1. API EventPass contra a cópia Neon requer transporte seguro da conexão, vinculada exclusivamente a br-floral-union-b86d5tmd antes da expiração. O GET autenticado da API de controle Neon foi validado sem expor segredo; não existe conector Neon nativo nem download seguro dessa resposta no acesso disponível. Cofre sem item EventPass/API Neon,1Password não conectado e nenhuma configuração CLI Neon autorizada encontrada. Integrações GitHub/Vercel aparecem como Add, Netlify como documentação Read. Não foram criadas integrações nem copiadas credenciais de outros projetos. A coleta segura já aberta permanece pendente, sem novo pedido de participação. DDL real passou, mas API Neon não foi executada. Não executar suíte destrutiva PG_TEST na cópia compartilhada.
2. Resend requer acesso/novo OAuth aprovado ou credencial específica, domínio/DNS verificados ou alternativa restrita de teste, destinatário controlado e autorização de envio. Nenhum aceite HTTP ou entrega real foi produzido.
3. Deploy Netlify depende de capacidade disponível e aprovação específica. Tempo de execução, logs de retenção, proteção dos previews e conexão pooler precisam ser revalidados no ambiente de destino antes da ativação.
4. PR está preparado em arquivo para revisão, não publicado. Push aguarda caminho seguro que não cause deploy indevido; autenticação não elimina esse risco.
5. Não foi emitida certificação LGPD. Retenção, acesso, base legal, políticas do controlador e processamento pelos fornecedores exigem revisão operacional. Endereços ficam em claro na outbox por necessidade de envio; payloads temporários são cifrados e apagados no estado terminal.

Runbook separado: EMAIL-RECOVERY-RUNBOOK.md. Plano de teste real e alternativa gratuita: RESEND-CONTROLLED-TEST.md. Nenhuma pendência acima foi apresentada como concluída.
