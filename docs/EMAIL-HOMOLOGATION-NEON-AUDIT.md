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

The connected database was observed to have `admins.id` and `registrations.id` as bigint, while the repository's initial Postgres schema uses SERIAL (integer). The connected database's `admins` table lacks `must_change_password`, required by the GitHub authentication route. This is a real compatibility blocker; do not mark migrations as applied without actually reconciling database objects.

## Isolated migration check

Used Neon temporary migration branch `br-square-bread-b8iu71u8` cloned from `homolog`. Applied the exact repo migration SQL for `003_email_outbox.sql` and `004_ticket_recovery.sql` on this *temporary* branch and verified that both tables exist. Then discarded the prepared migration (`apply_changes=false`) and confirmed the temporary branch was deleted. The parent homolog branch was untouched.

This proves the two DDL scripts are syntactically compatible with that temporary clone. It **does not** establish complete app/runtime compatibility, migration-history correctness, successful real email delivery or end-to-end production readiness.

## Activation blockers
1. Reconcile the real Neon schema and migration history with GitHub's app code; notably `must_change_password`. Do not edit the active homolog database before backups, owner approval and a disposable full-schema runtime test.
2. Verify the actual Netlify site, deployment revision, environment configuration and routing. No Netlify deployment connector is available in this ChatGPT session.
3. Configure verified Resend sending domain, DKIM/SPF, suitable restricted API credentials, and owned test recipients. No Resend connection was available to perform this.
4. Test the system on a disposable, isolated environment using fictitious participants; confirm worker scheduling, logging, idempotency and real delivery with controlled addresses.
5. Use `inspectEmailSchema` (read only) as a prerequisite but never as a substitute for full tests, backup/restore and human review.

Until these blockers are resolved, keep `EMAIL_ENABLED=false` and `TICKET_RECOVERY_ENABLED=false` in deployed environments. Do not apply migrations to the active homolog branch merely because an isolated DDL check passed.
