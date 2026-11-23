import type { DbClient } from '../../db/client.js';

export interface PruneResult {
  outboxRows: number;
  recoveryRows: number;
}

/** Remove only terminal deliveries and long-expired recovery tokens. */
export async function pruneEmailData(db: DbClient, now = new Date()): Promise<PruneResult> {
  const terminalCutoff = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
  const recoveryCutoff = new Date(now.getTime() - 24 * 3600_000).toISOString();
  return db.transaction(async (tx) => {
    const deletedEmails = await tx.run(
      "DELETE FROM email_outbox WHERE status IN ('sent', 'failed') AND updated_at < ?",
      [terminalCutoff],
    );
    const deletedRecoveries = await tx.run(
      'DELETE FROM ticket_recovery_requests WHERE expires_at < ?',
      [recoveryCutoff],
    );
    return { outboxRows: deletedEmails.rowCount, recoveryRows: deletedRecoveries.rowCount };
  });
}
