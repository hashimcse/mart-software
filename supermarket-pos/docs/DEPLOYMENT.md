# Deployment and recovery

## Windows demo

Double-click **Supermarket POS.exe** in the extracted project folder. Requires Windows with .NET Framework 4.x, Node.js 22.12+ including npm, and PostgreSQL 14+ installed in `C:\Program Files\PostgreSQL`. The executable starts the database/server and opens your default browser. Keep the whole project folder together. First setup installs dependencies and builds the app; later launches reuse them. Reopening the launcher reuses a healthy running server. Runtimes are not included in the ZIP.

Alternatively, run `./START-DEMO.ps1` from PowerShell 7.2+ in the project folder. Both launchers use a separate, password-protected local database on port 55440 and the app on port 4010. Files, credentials and logs are in `.local`. Demo credentials are in the README. These are demo launchers, not Windows service installers. Closing the browser does not stop the database/server.

The launcher requires an internet connection for first-time npm installation and Prisma generation. Protect `.local/demo.env`. Do not distribute `.local`, `.env`, uploads or backups with source archives. Stop the Node process identified by `.local/api.pid` only after verifying that the PID still belongs to this project's Node server. PostgreSQL can be stopped with `pg_ctl -D <project>/.local/pgdata stop` after the API stops.

## Real store: one server, multiple browser terminals

1. Use a dedicated server with PostgreSQL, Node.js 22.12+ and PostgreSQL client tools. Give it a stable private IP or internal DNS name. Use a UPS and an OS service supervisor for PostgreSQL and the Node server.
2. Create a password-protected PostgreSQL role and an empty database owned by it. Normal runtime needs no superuser rights. The staged restore feature needs CREATEDB; alternatively have an administrator perform offline restores with a separate maintenance credential. Keep PostgreSQL listening on localhost when the API is on the same host.
3. Copy `backend/.env.example` to `backend/.env`. Set HOST=127.0.0.1 behind a local reverse proxy (or a specific LAN address for direct store access), DATABASE_URL, a randomly generated ACCESS_TOKEN_SECRET (at least 32 characters), NODE_ENV=production, PORT and CORS_ORIGIN. Set PG_BIN_DIR to the PostgreSQL bin directory if the tools are not on PATH. Set BACKUP_DIR to protected storage and BACKUP_INTERVAL_HOURS=24. A value of 0 disables automatic backups.
4. From backend, run `npm ci --include=dev`, `npm run prisma:generate`, then `npm run prisma:deploy`. The repository contains a real initial SQL migration. For an **existing Phase 9 database**, see the upgrade section below before running anything.
5. For a clean store, set INITIAL_ADMIN_PASSWORD to a unique password of at least 12 characters and optionally INITIAL_ADMIN_USERNAME. Leave SEED_DEMO unset, then run `npm run prisma:seed`. This creates roles, units, a terminal and one administrator, without demo inventory or shared passwords. Remove INITIAL_ADMIN_PASSWORD from the environment afterward. Seeding an existing administrator does not reset its password.
6. Run `npm run build` in backend. In frontend run `npm ci --include=dev`, `npm run typecheck`, and `npm run build`. Leave VITE_API_BASE_URL unset for same-origin production hosting. The backend serves the compiled frontend and `/api` together.
7. Start from the **backend working directory** with `npm start`. Configure your OS service to use that working directory and load the same environment. Test `/api/health`. Publish behind an internal HTTPS reverse proxy. Allow only store devices through the firewall; do not expose the database or development server publicly. Configure CORS_ORIGIN to match the exact browser origin. The API has in-memory rate limits; this release is designed for one API process, so the scheduler and rate-limit counters are shared within that process.
8. Each till opens the same site URL. Use Team to create individual cashier/manager accounts. Add terminal records for additional tills (for example through an administrator SQL session: `INSERT INTO terminals (id,name,"isActive") VALUES (gen_random_uuid()::text,'POS-2',true);`). Select a different terminal at each till and open its cash shift. Scan a real barcode, complete a small test sale, return it, and close/reconcile the shift before entering production stock.

### Printers

Browser mode uses the printer installed on the individual till. Choose 58mm or 80mm in Settings and select that printer in the browser print dialog. Network mode is a shared store-level destination using raw ESC/POS TCP, usually port 9100. If each till has its own printer, use browser mode. Automatic per-terminal network-printer routing is not implemented. Verify paper width, tax wording, currency characters and cutter behavior on your actual hardware.

## Upgrade from an existing Phase 9 database

Do not apply the initial CREATE TABLE migration to a populated database. First stop writers, take a `pg_dump -Fc` backup and restore it into a separate staging database. The original ZIP contained no migration history. Have the administrator baseline that schema before applying additions: nullable `sale_items.unitCost`, `return_items.restock`, the held-bill/customer foreign key, and new indexes. `prisma migrate diff` can generate the SQL against the supplied schema; inspect it for orphan held-bill customer IDs before adding the FK. Test the full suite against a dedicated staging copy. Only switch after reconciliation.

Historical sales have no original cost snapshots. Their financial reports show profit as **Unavailable** instead of using today's purchase price. Existing return records also lack a persisted restock flag: the new column defaults to true, so audit old non-restocked returns and backfill the correct values before relying on historical COGS. Credit refunds now reduce customer debt only when their refund method is CREDIT; reconcile historical returns recorded as CASH if the old app had also reduced their debt. Never invent missing historical costs.

## Backups and restore

Backups uses PostgreSQL custom-format dumps. Each successful backup has a SHA-256 checksum and an adjacent product-image directory plus a JSON status manifest. The database Backup table holds successful metadata; manifests preserve failed operations and history independently of a restored database. Files are not publicly served. Database downloads require backup.manage.

Automatic backups run at the configured interval while the API is running. On restart, an overdue backup is attempted immediately. The server checks once a minute; there is no OS-level scheduler while it is stopped. Do not run multiple API instances against the same backup folder. There is no automatic deletion policy: monitor disk space and maintain off-device copies/retention with your storage administrator. A crash may leave a RUNNING manifest; check the files/logs and create a new backup.

To recover, choose Restore on a complete backup and type `RESTORE TO NEW DATABASE`. The server checks its checksum, creates a new named database, and runs pg_restore with a single transaction. It never overwrites the active store database. Validate the returned database with counts, recent invoice numbers, stock and balances. Stop all API writers, change DATABASE_URL to that database, copy the matching `<backup-id>.uploads` into backend/uploads, then restart and validate a till. Keep the old database for rollback. Restore failures may leave an empty staging database for administrator cleanup.

Product images are copied after the database snapshot. Pause product-image edits during a recovery-critical backup to guarantee an exact pairing. The downloadable `.dump` contains only the database; copy the **whole backup directory** to preserve images and manifests. Backup files contain business and authentication data: restrict access and encrypt off-device copies. Use pg_dump/pg_restore from the same PostgreSQL major version as the server or newer supported tools. The automated restore test used PostgreSQL 18.

## Tests

`npm test` in backend runs unit tests and explicitly skips database tests unless RUN_DB_TESTS=1. Integration tests require a dedicated seeded database whose name contains `test`; they create transaction fixtures and must never target store data. Set DATABASE_URL, ACCESS_TOKEN_SECRET, RUN_DB_TESTS=1, RUN_BACKUP_TESTS=1 and PG_BIN_DIR, then run `npm test`. Use SEED_DEMO=true when seeding that test database. The restore test creates a separate restored database and leaves it available for inspection.

Run `npm run typecheck` and `npm run build` in both directories. Run `npm audit` in both; the included lockfiles were checked with zero reported advisories on 2026-09-15. Dependency overrides for deepmerge-ts, mysql2 and uuid address transitive advisories; generation, exports and restore tests were rerun with these overrides.

## Operating limits

Reports accept up to 367 inclusive days and 10,000 transactions/products. Sales report rows show original sale values; refunds are separate period totals. Dates and dashboard daily boundaries are UTC. Inventory is a current snapshot, not an as-of-date reconstruction. Profit is an operating measure excluding financing, income tax and separate inventory write-offs. Money on the API remains decimal strings.

JWT permissions remain valid for the configured short access-token lifetime after an account/role change (15 minutes by default). Deactivated accounts cannot log in or refresh. Tokens use sessionStorage; HTTPS, trusted devices and protection against script injection are required. Browser printing and physical multi-terminal LAN operation still need store-site acceptance testing. The local load sample is not a capacity guarantee for a busy store.
