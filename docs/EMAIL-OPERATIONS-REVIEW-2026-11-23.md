EVENTPASS, revisão de continuidade23nov2026 10:27

Preservação
Backup git bundle restrito criado antes das alterações, com as7revisões até23a1df5 e todas as referências. git bundle verify aprovado. Patchv3 preservado e checksum conferido; aplicação em worktree independente já demonstrou árvore idêntica.

Revisão do diff
SQLite: a espera anterior só capturava a fila existente, permitindo uma operação livre e uma transação posterior correrem no mesmo ciclo. Agora toda operação get/all/run usa a mesma fila exclusiva, e o callback transacional recebe cliente dedicado. Regressões cobrem claims concorrentes, rollback, enqueue independente e ordem com transação posterior.
PG: IDs numéricos e strings decimais usam mesma chave bigint. Locks são transacionais, normalização não converte bigint paraNumber. Hashes textuais podem colidir com IDs e serializar trabalho não relacionado, mas não invalidam exclusão; isso é risco de contenção, não ausência de lock.
Worker: provider limitado, budget antes doHTTP, padrão fechado sem confirmação/alocação, reservas persistentes diárias/mensais concorrentes. Falhas ambíguas consomem reserva; esgotamento adia sem tentar enviar. Não prova saldo global da conta. Nenhuma ativação.
Retenção: função diária separada codificada, testada e empacotada; execução periódica real ainda não homologada. Flag desligada e nenhuma publicação.
Lockfile:106entradas deversão mudaram no audit fix compatível. Revisados root metadata, resolved/integrity,dev/runtime,Netlify e plataforma opcionais. Somente registry.npmjs.org nosresolved HTTP; declaraçõesdevroot iguais ao package.json; npm ci aprovado e runtime audit0. NetlifyCLI27.20.1,Fastify5.12.7,static10.1.12 dentro dosranges existentes. Nenhum --force nem host alternativo. Mudança é maior que patch mínimo por árvoreNetlify, preservada/testada para não reintroduzir vulnerabilidades;12moderadasdev permanecem.

Remoto
Regra versionada Vercel por branch exatafalse, schema oficial validado, sem alteração de configuração sensível. CInessa branch preparado. Push dry-run não escreveu e falhou por ausência deautenticação. gh nãoautenticado,semhelper/SSH/envtoken. IntegraçãoGitHub atual não oferece push decommits. Não reutilizar PAT deoutroescopo; essa lacuna éseparada do riscoVercel.
Neon: acessoAPIcontrole autenticado já validado200, segredo retido só na página. Transporte suportadoseguro atéexecução continuaausente; não replicar requisição para obtercookie/token,não usarserviço terceiro ou versãooriginal. Coletavault prévia fica pendente semnovaping.

O relatório v3 continua histórico da rodada anterior. Esta revisão acrescenta migration005, ensaiada às10:39 exclusivamente na cópia indicada, com sete nomes de histórico e tabela de orçamento vazia. Não aplicar ao banco ativo. A evidência DDL v3 isoladamente não cobria005; a evidência atual cobre. Antes da API na cópia, conferir novamente o manifesto sem apagar histórico. Cópia temporária expira24nov08:12.

Validação desta continuação
Node22: npmci,typecheck,lint,build aprovados. API108/web22/PG12 aprovados.
Node24: API108/web22/PG12 aprovados. HTTP pacote30/30 sobrePGlocal migrado005.
Empacotador real incluiapi,email-queue(5min),email-maintenance(diário03:17UTC).
Handler real de manutenção removeu1fixtureterminalantiga noPGlocal,semprovider.
ConfigVercel validada contra schemaoficial; nãofoi publicadanemtestada contra gatilhopós-push. Nenhuma credenciallocalGit disponível,pushdryrunfalhouantesdeescrever.
Backups epatches permanecemprivados; main/Neonativo/AWS/enviosreais/produçãointactos.

Cota oficial adicional: https://resend.com/docs/api-reference/rate-limit e https://resend.com/docs/knowledge-base/account-quotas-and-limits confirmam reset diárioUTC e que recebidos também consomem cota. Orçamento EventPass não deve ocupar a margem usada por inbound/outros consumidores. Sem prova da conta, EMAIL_BUDGET_CONFIRMED permanecefalse.

Atualização10:39Neon: migration005 aplicada somente à cópia br-floral-union-b86d5tmd, comBEGIN/COMMITeguarda0admins/participantes/inscrições. Confirmados7nomesdemigraçãoe0linhasdeorçamento. SchemaNeon17atualizado,nãoháAPIEventPasscontraNeon. Fonte https://console.neon.tech/app/projects/little-voice-72531404/branches/br-floral-union-b86d5tmd/sql-editor?database=eventpass .

Restauração atual10:42: dumpPGlocal já commanifesto005 e tabelaemail_send_budget, restaurado emdestinodescartávelnovo com1admin,5eventos,15inscrições,5migraçõese0reservas. HTTPempacotado30/30nodestinorestaurado. Somente fixtures. Este ensaio atual substitui o dump v3 de4migrações como evidência de compatibilidade do estado atual.
