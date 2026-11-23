# EventPass, ensaio de 23/nov/2026 (em andamento)

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

Expiração automática: 24/nov/2026 08:12 America/Sao_Paulo. Plano Free, PostgreSQL 17, retenção observada 6 horas, não os 7 dias citados no documento antigo. Não foi executada API contra Neon nesta etapa: conexão do console está mascarada e não foi extraída/exposta como texto. Testes API PostgreSQL locais são separados desta evidência DDL real.

## Netlify

Site e7bc4548-6a98-4d4a-b9ab-ca4929f719d1, incomparable-panda-7984de, equipe oenzoalmeida. Console: https://app.netlify.com/projects/incomparable-panda-7984de/overview . Site privado para publicado e previews, deploy CLI de 27/out, mensagem homolog, apenas função api. Sem ligação Git indicada no resumo. Variáveis presentes: COOKIE_SECURE, DATABASE_DIALECT, DATABASE_SSL, DATABASE_URL. Valores secretos não lidos. Não foram adicionadas flags ou chaves de e-mail.

Free, período 25/out a 24/nov, créditos normais esgotados. 28,2/30 créditos operacionais restantes até 24/nov, sites permanecem online, mas novos deploys publicados e Agent Runners pausados. Não presume necessidade de upgrade. Não houve tentativa de publicar.

Documentação oficial confirma cron UTC, 30s por execução e execução automática apenas em deploy publicado, não previews. Fonte: https://docs.netlify.com/build/functions/scheduled-functions/ . O lote de 2 não constitui, sozinho, prova do prazo total em caso de conexão lenta/timeout. Verificação adicional ainda pendente.

## Resend

Sem sessão ou credencial específica disponível. Login GitHub pede novo OAuth para leitura de e-mails; não autorizado nesta rodada. Domínios, DNS, remetente e chaves da conta não verificados. Nenhum envio. Limite gratuito público consultado: 3.000/mês, 100/dia, https://resend.com/pricing . Destinatário simulado de teste do provedor não é prova de entrega em caixa real. Entrega real depende de acesso, remetente e autorização expressa de destinatário controlado.

## Próximas verificações

- Exercitar orçamento temporal/worker, E2E legado bigint e restauração local; revisão final de privacidade e visual.
- Confirmar integrações automáticas externas antes de qualquer push. Há apps GitHub Vercel, Render e Northflank instalados; não foi presumida ausência de deploys.
- Versionar correções e preparar texto de PR para revisão, sem merge.
