import type { DbClient } from '../../db/client.js';

export class EmailBudgetUnavailable extends Error {}

/** Persisted UTC allocation shared by CLI and scheduled workers. Each attempt consumes
 * one reservation before external I/O; ambiguous failures are never refunded.
 * This is an application allocation, not a guess of the provider account's balance.
 */
export async function reserveSendBudget(db: DbClient, daily: number, monthly: number, now = new Date()): Promise<boolean> {
  if (!Number.isInteger(daily) || !Number.isInteger(monthly) || daily < 1 || monthly < 1 || daily > 100 || monthly > 3000) return false;
  const date = now.toISOString();
  const periods = [{ key: 'day:' + date.slice(0, 10), limit: daily }, { key: 'month:' + date.slice(0, 7), limit: monthly }];
  return db.transaction(async (tx) => {
    await tx.lock('email-send-budget');
    for (const p of periods) {
      await tx.run('INSERT INTO email_send_budget(period_key, attempts) VALUES (?, 0) ON CONFLICT(period_key) DO NOTHING', [p.key]);
      const row = await tx.get<{ attempts: number }>('SELECT attempts FROM email_send_budget WHERE period_key = ?', [p.key]);
      if (Number(row?.attempts ?? p.limit) >= p.limit) return false;
    }
    for (const p of periods) await tx.run('UPDATE email_send_budget SET attempts = attempts + 1 WHERE period_key = ?', [p.key]);
    return true;
  });
}
