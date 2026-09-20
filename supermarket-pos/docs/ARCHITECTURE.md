# Architecture — current release

React/TypeScript/Vite frontend → Express/TypeScript API → Prisma 7 + pg adapter → PostgreSQL. In production Express also serves the built frontend, so the default API URL is /api. Development can use separate Vite/API origins.

## Persistence and build

Prisma datasource configuration is in backend/prisma.config.ts. The prisma-client-js generator emits a CommonJS-compatible client into src/generated/prisma; the pg adapter keeps database queries on the JavaScript driver. Generation still needs Prisma's schema tooling. The initial migration contains the complete schema. Never replay it on an existing unbaselined Phase 9 database.

UUID keys and PostgreSQL Decimal columns are retained. Transaction data is authoritative; customer/supplier balances are computed. Product.currentStock is a guarded, transactionally maintained balance. SaleItem.unitCost is nullable only to represent unavailable historical costs. ReturnItem.restock records whether a return reverses COGS.

## Transactions

Sales validate payment coverage and permissions, snapshot costs, deduct stock, create payments/inventory/cash movements and audit records in one transaction. Decimal values are rounded to cents before monetary persistence. Row locks on terminals serialize drawer changes with close-out; guarded product updates prevent negative stock. Returns lock the sale before checking all prior returned quantities. Purchase receiving/returns lock the purchase before transitions or return caps. Cash open/close/manual moves and cash-linked expenses share the terminal locking convention.

The audit helper accepts a transaction client. Do not substitute a global client for an audit write inside a business transaction. For cross-terminal operations, PostgreSQL may reject a deadlock/serialization conflict; clients receive a conflict/error and must retry after reviewing state.

## Reports

report.service.ts validates UTC inclusive day ranges, uses a repeatable-read transaction, and bounds rows/time range. Sales groupings include day, Monday-start week, month, cashier, product, category, customer and payment method. Original sale values and period refunds are distinct. Product/cart allocations reconcile to each sale total. Financial amounts exclude proportional net tax, include expenses and snapshot COGS, and withhold profit when a contributing historic cost is missing. Inventory data is current and cost fields require profits.view.

CSV cells escape quotes and neutralize leading spreadsheet-formula characters. XLSX cells are literal strings, preserving exact decimal text. PDFKit produces actual PDF files. Report text and tables render via React text nodes, not HTML injection.

## Backup and recovery

backup.service.ts shells out without a shell using explicit argument arrays and PostgreSQL environment variables. Passwords are not placed in command arguments. Backups live outside public assets. A UUID restricts downloadable filenames; checksum validation precedes download/restore. A matching uploads directory and status manifest accompany each archive. Failures are surfaced in the history/logs.

The process-local scheduler checks once a minute and catches up on startup; the deployment uses one API instance. A restore always stages a new database. Live database switching is an administrator operation after validation. See DEPLOYMENT.md for consistency, storage and retention limits.

## Auth and hardening

JWT access tokens hold role/permissions for their short lifetime. Refresh tokens are stored hashed and claimed atomically on rotation; deactivated accounts cannot log in or refresh. Login performs bcrypt work for unknown users as well. Global/auth/backup rate limits, strict report/settings validation, response error normalization and secret validation supplement existing Helmet/CORS/upload controls. Staff deactivation never returns password hashes. SessionStorage token storage and delayed permission revocation remain explicit deployment tradeoffs.

Dependency lockfiles include tested transitive overrides for deepmerge-ts, mysql2 and uuid. Vite was upgraded; the deprecated ts-node-dev runner was replaced with tsx. See VERIFICATION.md for current audit and test results rather than relying on historical claims.
