# Migração Vercel/Neon

A migração de runtime foi implementada na branch feat/vercel-neon-migration. O backend usa pg e transações PostgreSQL. As migrações em migrations-postgres são aplicadas explicitamente, com advisory lock. O antigo esquema SQLite permanece apenas para leitura/importação e referência de compatibilidade.

vercel.json publica apps/web/dist e encaminha /api ao adaptador api/index.ts. O pool é reutilizado entre invocações e integrado a attachDatabasePool no ambiente Vercel. Sessões e rate limits não dependem da memória da instância.

Foi provisionado exclusivamente o projeto Neon eventpass-homolog, na organização com plano free. A publicação Vercel depende de restabelecer o acesso ao time tech-lead1. A CLI local informou VERCEL_TOKEN inválido e o conector retornou HTTP 403. O usuário escolheu concluir o trabalho possível sem deploy. Não há URL publicada validada nesta execução e a main não deve ser integrada antes do CI completo.

A importação de dados existentes requer o arquivo SQLite de origem. O script abre a origem em modo somente leitura e recusa destino preenchido. Nenhum dado real de origem foi fornecido ou presumido. Testes de importação e backup usam somente fixtures sintéticas.
