# Supermarket POS handoff — continuation through Phase 13

Updated 2026-09-16. The original source ZIP was supermarket-pos-phase9-handoff.zip. Original handoff and architecture documents are preserved as HANDOFF_PHASE9.md and ARCHITECTURE_PHASE9.md. They are historical context, not current verification evidence.

## What changed

Phases 10–13 are implemented: sales/inventory/financial reports and exports, charted dashboard, manual/scheduled backups and staged restore, security/dependency fixes, persistent tests and deployment instructions. Team now exposes staff account creation/activation. START-DEMO.ps1 builds and starts a separate local Windows demo; DEPLOYMENT.md explains real-store installation and recovery.

The previous backend had never generated Prisma Client or run against PostgreSQL. This continuation repaired its Prisma 7 configuration, the missing HeldBill.customer relation and generated-client packaging. Both applications now typecheck/build, and PostgreSQL integration tests run against an isolated database.

## Critical behavior

- Decimal money/quantities remain strings on the wire. Sale items snapshot purchase cost at checkout. Legacy null costs cause financial profit to be unavailable, never estimated from today's catalog.
- Returns allocate the actual sale total including cart discounts. Cumulative cent rounding keeps repeated partial refunds equal to the amount paid. A sale row lock prevents concurrent over-returns. Purchase receiving/returns use purchase locks.
- Stock decrement guards remain in place. Terminal locks coordinate shifts, sales, expenses and cash refunds. Audit writes within these business transactions use their transaction client.
- Credit sales require a credit-enabled customer and enforce the customer's limit under a customer lock. CREDIT refunds reduce debt once per sale; CASH refunds leave debt unchanged. Aggregate limits combine line and cart discounts.
- Reports use UTC date boundaries and a repeatable-read snapshot. Financial reports exclude tax from revenue and reverse original cost for restocked returns. Current inventory is not a historical inventory ledger. See the report notes and deployment limits.
- Backups call pg_dump, verify the archive and checksum it. Restore creates a separate database using pg_restore --single-transaction; the operator explicitly switches the store after validation. Never add an unguarded live-database overwrite path.
- The production backend serves frontend/dist. Generate Prisma before building; scripts/copy-client.cjs copies its runtime into dist. Start from backend as working directory.

## Verification

See VERIFICATION.md. The final regression run passed 20 Node test entries (16 integration subtests, their parent, and 3 unit tests), including real database restore and financial reconciliation. No physical printer or separate LAN hardware was available for acceptance testing. Do not describe that as verified.

## Setup

See DEPLOYMENT.md. A clean seed requires INITIAL_ADMIN_PASSWORD; SEED_DEMO=true is explicit opt-in to shared demo credentials and demo inventory. The archive excludes dependencies, generated clients, builds, databases, local secrets and backups.

## Future extensions / boundaries

Offline sale syncing, automatic loyalty redemption at checkout, historical inventory reconstruction, arbitrary role editing and per-terminal network-printer routing are outside this delivered scope. Existing Phase 9 data needs the documented baseline/backfill process. Report limits and date semantics are intentional and user-visible.
