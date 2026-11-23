> Auditoria histórica anterior, não runbook atual. O manifesto atual inclui005_email_operations. Para instruções vigentes use EMAIL-ROLLOUT.md e EMAIL-RECOVERY-RUNBOOK.md; evidências atuais em EMAIL-OPERATIONS-REVIEW-2026-11-23.md.

# EventPass: Neon homologation preflight

**Read-only audit on 2026-11-23. No production changes.**

Connected Neon project: `eventpass-homolog` (`little-voice-72531404`), branch `homolog` (`br-patient-wind-b86oqnp2`), database `eventpass`.

## Observed migration records

The connected database's `public.schema_migrations` contains:
- `001_initial.sql`
- `002_serverless.sql`
- `003_point_ownership.sql`

The current GitHub EventPass feature branch expects:
- `001_initial.sql`
- `002_password_change.sql`
- `003_email_outbox.sql`
- `004_ticket_recovery.sql`

The connected database was observed to have `admins.id` and `registrations.id` as bigint, while the repository's initial Postgres schema uses SERIAL (integer). The connected database's `admins` table lacks `must_change_password`, required by the GitHub authentication route. This requires a controlled migration, not replacement of the existing migration history. The schema must be reconciled before activation.

## Isolated migration check

Used Neon temporary migration branch `br-square-bread-b8iu71u8` cloned from `homolog`. Applied the exact repo migration SQL for `003_email_outbox.sql` and `004_ticket_recovery.sql` on this *temporary* branch and verified that both tables exist. Then discarded the prepared migration (`apply_changes=false`) and confirmed the temporary branch was deleted. The parent homolog branch was untouched.

This proves the two DDL scripts are syntactically compatible with that temporary clone. It **does not** establish complete app/runtime compatibility, migration-history correctness, successful real email delivery or end-to-end production readiness.

## Activation blockers
1. After approval and backup, apply the three new migrations to the intended Neon branch, retaining the historical migration entries, and validate runtime compatibility. The isolated DDL/manifest path has now been tested, but the active homolog database is unchanged.
2. Verify the actual Netlify site, deployment revision, environment configuration and routing. No Netlify deployment connector is available in this ChatGPT session.
3. Configure verified Resend sending domain, DKIM/SPF, suitable restricted API credentials, and owned test recipients. No Resend connection was available to perform this.
4. Test the system on a disposable, isolated environment using fictitious participants; confirm worker scheduling, logging, idempotency and real delivery with controlled addresses.
5. Use `inspectEmailSchema` (read only) as a prerequisite but never as a substitute for full tests, backup/restore and human review.

Until these blockers are resolved, keep `EMAIL_ENABLED=false` and `TICKET_RECOVERY_ENABLED=false` in deployed environments. Do not apply migrations to the active homolog branch merely because an isolated DDL check passed.

## Additional isolated reconciliation test (2026-11-23)

A second temporary Neon branch (`br-square-darkness-b82pvtfr`) was created from `homolog`. The exact `002_password_change.sql`, `003_email_outbox.sql`, and `004_ticket_recovery.sql` SQL applied successfully. The `admins.must_change_password` column and both tables were verified. The three new migration names were inserted in `schema_migrations` in a single transaction and the original `002_serverless.sql` and `003_point_ownership.sql` entries were preserved.

The temporary branch was discarded with `apply_changes=false`, and deletion was confirmed. The primary homolog database was not modified. This establishes a **tested schema reconciliation path**, but not deployment or application runtime readiness.

Do not relabel old migrations, delete historical records, or run the new migration set directly against the original database without a backup and specific approval. A database migration rehearsal has been added to the PostgreSQL CI suite, using a disposable Postgres instance and approximating the known legacy differences. It does not replicate every object or property of the actual Neon instance.
