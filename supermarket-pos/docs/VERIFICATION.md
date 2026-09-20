# Verification — 2026-09-16

## Windows executable

Compiled `Supermarket POS.exe` with the Windows .NET Framework C# compiler. Runtime discovery and headless startup completed successfully, starting the local database/server. Repeat launch passed after using explicit IPv4 for readiness checks: the running server was reused and `/api/health` returned `ok`. The GUI/browser-opening path is compiled but was not exercised through an automated double-click. The executable requires the project folder and installed Node.js/PostgreSQL; it does not bundle those runtimes.

## Executed successfully

- Prisma 7.9.1 client generation, actual PostgreSQL schema migration and demo seeding on Windows/PostgreSQL 18.
- Backend TypeScript typecheck and production build, including the generated-client runtime copy.
- Frontend TypeScript typecheck and Vite 8.3 production build.
- npm audit in backend and frontend: zero reported vulnerabilities with the delivered lockfiles and overrides.
- Regression run: **20 passing Node test entries**, no failures/skips. This is 16 database subtests, their parent and 3 unit tests. The suite tests real HTTP routes against PostgreSQL, not mocked services.
- A pg_dump archive was restored by pg_restore into a separate database. SQL reads verified a known product and the exact 2.99 sale total in the restored database.
- Browser sign-in, dashboard trend, populated report layout and export controls were inspected against the compiled production application.

## Regression coverage

Login, RBAC denial, malformed JSON; concurrent single-use refresh; concurrent shift opening; applied cash/change and cost snapshots; transactional sale audit; cart-discount-aware repeated partial refunds; concurrent over-return rejection; missing-customer credit denial; rollback on insufficient stock; cross-terminal last-unit contention; all eight sales groupings; inventory/financial reports; invalid date rejection; CSV/XLSX/PDF signatures; atomic purchase receiving; shift reconciliation and post-close movement rejection; tax/revenue/COGS reconciliation after a catalog cost change; split-credit refunds and credit limits; cost-field redaction; barcode lookup load; real backup restoration. Unit tests cover CSV formula escaping, date boundaries and positive string quantities.

## Local performance sample

The final sample made 100 barcode HTTP requests with concurrency 10 on this computer and a small seeded test database: p50 **39.5 ms**, p95 **69.3 ms**, maximum **164.7 ms**. No request failed. This is a local functional load sample, not a guarantee for a production-sized catalog or network. Benchmark with the actual store data and expected peak traffic before go-live.

## Limits of this evidence

No physical receipt printer was exercised. A real store's independent tills, network outages, UPS, HTTPS reverse proxy and recovery storage were not available. Browser layout checks were desktop-sized; this is a desktop/till application. Financial reports explicitly withhold profit for missing historical costs and do not reconstruct historical stock. The pg driver emitted a non-failing deprecation warning about concurrent queries on a transaction connection; supported pg 8 tests passed, and pg 9 upgrades require review.

This release is ready for store-site acceptance testing using DEPLOYMENT.md. Do not equate the earlier Phase 9 handoff's type-check claims with end-to-end testing; its original limitations and assertions are retained only in the archived documents.

The Windows START-DEMO.ps1 launcher was executed successfully on 2026-09-16, including clean dependency installation, migration/seed, production builds and startup. An AUTOMATIC backup completed after startup. Upload regression coverage rejects HTML with a forged image MIME and stores a valid PNG with a server-chosen .png extension.
