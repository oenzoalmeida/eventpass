# EventPass: backup, migração e recuperação

Plano preparado em 23/nov/2026. Nenhum comando abaixo autoriza alterar o banco ativo ou publicar. PostgreSQL local 14 foi exercitado; Neon17 teve somente ensaio DDL na cópia vazia. O teste API Neon continua dependente de conexão segura da cópia.

## Antes de uma janela autorizada

1. Confirmar projeto, branch, endpoint, banco e papel. Conferir isolamento por metadados, não por aparência do nome.
2. Confirmar acesso, escopo e espaço para backup, sem imprimir URL ou segredo. Usar arquivo de serviço e passfile PostgreSQL com permissão0600, não senha em argumentos do processo. Definir PGSERVICE com o identificador revisado.
3. Desligar EMAIL_ENABLED e TICKET_RECOVERY_ENABLED. Pausar o scheduler. Suspender inscrições/check-ins durante a janela para não perder escritas em rollback.
4. Registrar contagens agregadas e nomes de schema_migrations. Não exportar registros pessoais para relatórios.
5. `pg_dump --format=custom --no-owner --no-acl --file backup.dump`. Guardar cifrado, com acesso restrito e prazo de descarte. O dump contém dados pessoais mesmo que os logs não contenham.
6. Restaurar com `pg_restore --exit-on-error --no-owner --no-acl --dbname ALVO_DESCARTAVEL backup.dump` usando um alvo vazio previamente conferido. Não usar `--clean` em alvo existente sem revisão específica.
7. Comparar contagens, histórico, constraints e funcionalidades no destino. Restaurar o banco não restaura a chave EMAIL_ENCRYPTION_KEY, que precisa de backup separado em cofre. Perder a chave torna payloads pendentes indecifráveis.

## Migração, só depois da autorização

- Executar diagnóstico `npm run email:preflight -w @eventpass/api` com DATABASE_DIALECT=postgres e conexão revisada.
- Histórico Neon legado contém 001_initial,002_serverless,003_point_ownership. Não apagar nem renomear registros históricos para forçar aprovação.
- Aplicar os três arquivos novos 002_password_change,003_email_outbox,004_ticket_recovery e registrar seus nomes apenas após sucesso. O executor existente aplica cada arquivo em transação e preserva nomes legados. Fazer na cópia antes do alvo ativo.
- Conferir seis nomes no alvo legado atualizado, coluna admins.must_change_password, tabelas, índices e FKs. Executar preflight novamente.
- Publicar somente na janela aprovada, com DB_AUTO_MIGRATE=false. Não misturar publicação de código e ativação de envio.
- Validar login fictício, inscrição, outbox cifrada, worker simulado, recuperação única, QR antigo inválido, check-in novo e rollback. Envio real depende de remetente/DNS/credencial e destinatário controlado autorizado.

## Retorno

- Primeira contenção: desligar ambas flags e suspender scheduler. Não desfazer migrações aditivas automaticamente.
- Código anterior deve ser a revisão explicitamente escolhida pelo responsável. Validar compatibilidade de esquema antes da troca.
- Se restauração integral for necessária, congelar escritas, preservar também o estado defeituoso para investigação, restaurar em destino separado e validar antes de trocar conexão. Backup antigo descarta escritas posteriores; decisão pertence ao responsável.
- Revalidar ingressos/QRs: restaurar snapshot antigo pode fazer tokens antigos voltarem a valer. Não retomar check-in sem reconciliar esse risco.
- Reconciliar outbox com o provedor antes de reativar: um snapshot pode trazer de volta tarefas já entregues. Idempotência do Resend não é garantia eterna e pode expirar antes da restauração.
- Executar manutenção separada `npm run email:prune -w @eventpass/api`, pelo menos diariamente no ambiente aprovado. O scheduler curto entrega mensagens, mas não limpa retenção. Não há agendamento de manutenção instalado.

## Evidência já obtida

Dump/restore de fixture local com1 admin,1 evento,3 inscrições,4 migrações, seguido de30/30 verificações HTTP no banco restaurado. Não é recuperação do banco ativo nem evidência API Neon. A retenção atual observada do Neon é6h; não confiar em material antigo que menciona7dias. Backup lógico independente é necessário antes de uma migração autorizada.
