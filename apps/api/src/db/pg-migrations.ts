/**
 * Nomes dos arquivos de migrations-pg que o banco deve ter aplicados.
 *
 * Embutido em código porque o bundle serverless (Netlify Functions) não
 * inclui os arquivos .sql: em produção a verificação de versão do schema
 * usa esta lista, sem ler disco. Ao adicionar 002_*.sql, atualize aqui.
 */
export const PG_MIGRATIONS: readonly string[] = ['001_initial.sql', '002_password_change.sql'];
