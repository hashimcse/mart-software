# Supermarket POS — Project Handoff Brief

Written so another assistant (or developer) with no access to prior conversation history can pick this project up and continue it correctly. This file is self-contained — read it top to bottom before touching code.

---

## 1. What this project is

A production-oriented Point of Sale and store management system for a supermarket/mart, being built in **13 phases** against a detailed original spec (barcode scanning, POS billing, thermal printing, inventory, purchasing, suppliers, customers/loyalty, returns, cash register, expenses, reports, backups, security hardening, testing/deployment). **Phases 1–9 are done.** Phases 10–13 remain.

Everything below reflects the actual current state of the code, not aspiration — if something isn't listed as built, it isn't built.

## 2. Stack

- **Backend:** Node.js, Express, TypeScript, **Prisma ORM 7** (Rust-free — TS/WASM query compiler + `@prisma/adapter-pg`, no native binary), PostgreSQL, JWT auth (rotating refresh tokens), `bcryptjs` (pure JS, no native build step — matters if a POS terminal is Windows without build tools), `multer` (image upload), Node's built-in `net` for raw ESC/POS printer sockets, `zod` for validation.
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, React Router 7.

Root layout:
```
supermarket-pos/
  backend/    Express API — prisma/ (schema + seed), src/{config,controllers,services,middleware,routes,schemas,utils}
  frontend/   React app — src/{pages,components,context,lib,types}
  docs/       ARCHITECTURE.md, ROADMAP.md (both already in the repo — read them, they're detailed)
  README.md   setup instructions, full API reference, demo credentials
```

`docs/ARCHITECTURE.md` and `docs/ROADMAP.md` already exist in this repo and go deeper than this brief on rationale for each decision — this document summarizes them plus everything since, so you don't have to reconstruct it from git history.

## 3. Core architectural decisions (apply these to any new work)

1. **UUID primary keys everywhere**, app-generated (`@default(uuid())`), not DB auto-increment — chosen so an offline POS terminal could someday generate a valid row ID before syncing (relevant if Phase 12+ ever tackles offline resilience).
2. **Money and quantities are strings on the wire, never JSON numbers.** A JSON number has already been through JS float parsing before any of our code runs. Every price/quantity/amount field is a zod-validated regex string (`"12.99"`, `"0.5"`) that goes straight into `Prisma.Decimal`. The **only** exception is the frontend's live cart-tax preview (`frontend/src/lib/cartMath.ts`), which is plain floating point for responsiveness and is explicitly commented as preview-only — the backend's Decimal math is always authoritative and its response is what's actually shown/stored.
3. **Computed balances, never stored running totals** — supplier outstanding balance and customer credit balance are both computed fresh on every read from their underlying transactions (purchases/payments, credit-sales/customer-payments), not stored columns that could drift out of sync. `Product.currentStock` is the one deliberate exception (a stored, transactionally-maintained running total), because sales/adjustments/purchases all need atomic guarded updates against it anyway.
4. **Race-safe stock changes via guarded UPDATE, not read-then-write.** Every stock decrement (sales, damaged/expired writeoffs, purchase returns) uses `UPDATE products SET stock = stock - qty WHERE stock >= qty` (`prisma.product.updateMany({ where: { id, currentStock: { gte: qty } }, ... })`), checking `result.count === 0` for "insufficient stock." This makes it structurally impossible for stock to go negative and correctly serializes two terminals racing for the same last unit, with zero explicit locking.
5. **RBAC is database rows, not hardcoded enums.** 5 seeded roles (ADMIN, MANAGER, CASHIER, INVENTORY_MANAGER, ACCOUNTANT), ~20 permission keys, `role_permissions` join table. JWT access tokens embed the permission list at issue time (15 min TTL) so the auth middleware never hits the DB per-request — deliberate speed/freshness tradeoff.
6. **One shared transaction-scoped helper reused across callers**, not parallel implementations — e.g. `inventory.service.ts`'s `applyStockChange` backs sales, adjustments, and damaged/expired writeoffs alike.
7. **Sale payments store the amount *applied*, not the amount *tendered*.** For cash, change given back is computed and returned in the API response but never inflates `Payment.amount` — `sum(Payment.amount) === Sale.total` is a clean invariant. This turned out to also be exactly the right value for cash-drawer reconciliation (Phase 9) — `tendered − change = applied`, so no separate "tendered" tracking was ever needed. Verified this algebraically, not assumed.

## 4. Database schema (Prisma) — every model that exists right now

`Role`, `Permission`, `RolePermission`, `User`, `RefreshToken` — auth/RBAC.
`Category` (self-referential tree), `Brand`, `Unit`, `Supplier`, `Product`, `Tax`, `Discount` — catalog.
`Customer`, `CustomerPayment` — customers/credit.
`Terminal`, `Sale`, `SaleItem`, `Payment`, `HeldBill` — POS/billing.
`Purchase`, `PurchaseItem`, `SupplierPayment`, `PurchaseReturn`, `PurchaseReturnItem` — purchasing.
`InventoryMovement` — unified stock ledger (types: SALE, PURCHASE, ADJUSTMENT, RETURN, DAMAGED, EXPIRED).
`Return`, `ReturnItem` — sale returns.
`CashSession`, `CashMovement` — cash register.
`Expense` — expenses.
`AuditLog`, `Setting`, `Backup` (model exists, **no backup logic built yet** — Phase 11), `Counter` (generic named sequence backing invoice/PO/return numbers).

Full field-level detail is in `backend/prisma/schema.prisma` — read it directly rather than guessing field names.

## 5. What's built, phase by phase

**Phase 1 — Architecture, schema, auth.** Full schema designed up front. Login/refresh/logout/me, bcrypt hashing, rotating refresh tokens, RBAC middleware, audit logging.

**Phase 2 — Catalog.** Full CRUD for products/categories/brands/units. Server-side search/filter/pagination. Barcode/SKU uniqueness at the DB level with friendly conflict errors. `products.price.edit` is a separate permission from `products.edit`. Local image upload (multer, served from `/uploads`).

**Phase 3 — POS screen.** One input handles barcode scan (Enter → exact lookup) and free-text search. Live cart, per-line discounts, hold/resume bills, customer quick-add, keyboard shortcuts (F1/F2/F4/F5/F8/Delete). Real checkout: atomic invoice numbering (via `Counter`), race-safe stock deduction, decimal-safe tax math (inclusive and exclusive), discount-amount permission gating (>20% of line/cart value needs `discounts.apply_large`, not just `discounts.apply`).

**Phase 4 — Billing + printing.** Split payments (any mix of methods; at most one CASH line, which covers the remainder and can produce change). Two real printing paths since this is a web app, not a desktop shell: (a) browser-native print via an isolated window sized exactly for 58mm/80mm paper, for printers installed as a normal system printer; (b) real ESC/POS byte generation (`backend/src/utils/escpos.ts`) dispatched over raw TCP to port 9100 (the standard network-thermal-printer raw-print port), plus a raw `.escpos` file download for USB-only printers. Settings page for store info + printer config.

**Phase 5 — Inventory.** Stock adjustments (signed quantity + required reason), damaged/expired writeoffs (all three share one guarded-update helper), low-stock/out-of-stock/expiring-soon alerts, stock valuation (cost/retail/potential-profit), paginated movement ledger. Dashboard wired to real numbers (today's sales, transactions, low-stock count — "pending payments" stayed a placeholder until Phase 7).

**Phase 6 — Purchases + suppliers.** Full PO lifecycle: ORDERED → RECEIVED (stock only increases here, not on order creation) → INVOICED → PAID (auto-transitions once payments cover the total, but only after actually received). Cancellation only allowed while still ORDERED. Supplier records with computed outstanding balance.

**Phase 7 — Customers + loyalty.** Full customer CRUD (walk-in/registered/credit), computed credit balance (`sum(CREDIT sale payments) − sum(CustomerPayment)`), purchase history, payment recording. Loyalty points accrue automatically at checkout (rate configurable via Settings: `loyalty.enabled`, `loyalty.pointsPerHundred`), truncated down to a whole point. Redemption is a manual "adjust points" action, not a one-click checkout button — deliberate scope call (see docs/ARCHITECTURE.md for why). Dashboard's last placeholder ("Pending payments") went live here.

**Phase 8 — Returns/refunds.** Full/partial sale returns, refunded proportionally to what was actually paid per unit (`(subtotal+tax)/quantity × returnQty` — correctly handles a discounted or tax-inclusive line). Over-return capped across *repeated* partial returns (sums every prior `ReturnItem`, not just checks the first return). Per-line restock-or-not choice. Sale status transitions to PARTIALLY_RETURNED or RETURNED based on every line, not just the one being returned now. A return against a credit-paid sale reduces what the customer owes, capped per-sale. Also shipped purchase returns (deferred from Phase 6) — same partial-tracking pattern, sending stock back to a supplier.

**Phase 9 — Cash register + expenses.** Shift open (with float) → cash in/out during the shift → close (enter actual counted cash, get expected cash + difference). Sales and cash refunds auto-post to whichever terminal has an open session (opportunistic linking — a terminal with no open session still rings up sales exactly as before). Expenses (category/description/amount/payment method), optionally drawn from an open register.

## 6. Verification status — be honest about this, don't overstate it

**Frontend is fully, mechanically verified** at every phase: `npm install && tsc --noEmit && npm run build` all run clean, no errors, right now, in this repo.

**Backend has exactly one blocker, and it's environmental, not a code defect:** `npx prisma generate` needs to download a schema-parsing binary from `binaries.prisma.sh`. In the sandbox this was built in, that domain wasn't reachable, so the Prisma Client was **never actually generated**, and therefore the backend's `tsc --noEmit` has never run fully clean — every single error it produces is a "cannot find module '../generated/prisma'" plus downstream `any`/`{}` types that cascade from that one missing import (verified this cascade pattern holds for every new error introduced in every phase, not assumed). **On a normal machine with regular internet access, `npx prisma generate` takes a few seconds and every one of those errors disappears.** This has never been end-to-end tested against a live Postgres database — that's the single most important thing to do first if you pick this up.

What *was* independently verified, standalone, without a database (pure logic/math, run for real with actual assertions, not just read for plausibility):
- JWT sign/verify/tamper-rejection, bcrypt hash/verify, refresh token generation/hashing.
- ESC/POS byte generation checked byte-for-byte against real command sequences, plus sent over an actual local TCP socket to confirm bytes arrive unmodified; printer error paths (refused/timeout) confirmed to fail cleanly.
- Split-payment resolution (11 scenarios), low-stock/valuation math (8 scenarios), supplier balance + auto-PAID transitions (8 scenarios), loyalty accrual + customer balance (12 scenarios), return/refund proportional math + over-return capping (13 scenarios), cash register tendered-vs-applied equivalence + full-shift reconciliation (8 scenarios) — all with real Decimal arithmetic, using the same library Prisma wraps.

**Real bugs actually caught and fixed during this build** (i.e., not the Prisma sandbox issue): a TypeScript structural-typing mismatch in the pagination helper, a vulnerable multer 1.x dependency, a react-router-dom security advisory — all in Phase 2, all fixed in the current `package.json`.

**Known, documented, deliberately-left items:**
- An esbuild dev-server-only advisory (Vite toolchain) — fixable only via an untested Vite major bump; low real risk since it only affects `vite dev`, not the production build.
- A `deepmerge-ts` DoS advisory, transitive dependency of Prisma's *CLI* config parser (not the runtime client) — no fix exists yet at the current latest Prisma version; the only "fix" would downgrade Prisma below 6.13 and undo the whole Rust-free architecture choice.
- Login isn't fully constant-time between "user doesn't exist" and "wrong password."

## 7. Remaining roadmap (Phases 10–13) — not started

- **Phase 10 — Reports + dashboard.** Sales by day/week/month/cashier/product/category/customer, payment-method breakdown, inventory reports (current/low/expired/valuation — some of this data already exists via Phase 5's endpoints, just needs report framing + date-range filtering), financial reports (revenue, COGS, gross profit, discounts, taxes, expenses, net profit — this is the first phase that needs to pull numbers from *multiple* existing modules together). CSV/Excel/PDF export. This is also naturally where the full charted dashboard (the spec's original dashboard ask, beyond Phase 5's 4 plain numbers) belongs.
- **Phase 11 — Backup/restore.** The `Backup` model exists in the schema but nothing writes to it yet. Needs: manual + scheduled `pg_dump`-based backup (or Prisma-driven export), restore flow, backup history list. Given the Prisma-CLI sandbox limitation documented above, backup/restore logic should be tested directly against Postgres tooling (`pg_dump`/`pg_restore`) rather than assumed to work.
- **Phase 12 — Security + performance hardening.** Explicitly deferred items to close out here: the login timing side-channel (§6), the esbuild/deepmerge-ts advisories (revisit whether fixes exist by then), the hardcoded 20%-large-discount threshold (move to Settings), general rate-limiting sweep beyond just `/auth/login`, index/query review, load-testing the barcode lookup path specifically (spec explicitly calls out barcode/SKU lookup speed).
- **Phase 13 — Testing + deployment.** An actual automated test suite (nothing here so far is a persistent automated test — all verification so far was standalone one-off scripts run and discarded during development, described in §6). Deployment docs for a real multi-terminal LAN setup covers Postgres install, `.env` config, multiple frontend builds pointed at one backend, printer setup per terminal.

If continuing phase-by-phase, keep doing what's worked for 1–9: read `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` first, write real logic (no stubs/fakes), verify with `tsc --noEmit` + `vite build` on the frontend every time, verify new backend math standalone with real assertions when it's non-trivial (money, dates, aggregations), update both docs files and the README's feature list + API table after each phase, then re-zip.

## 8. Running it

```bash
# Postgres: CREATE USER pos_user WITH PASSWORD 'pos_password'; CREATE DATABASE pos_db OWNER pos_user;
cd backend
cp .env.example .env        # edit DATABASE_URL / ACCESS_TOKEN_SECRET
npm install
npx prisma generate         # needs real internet access — this is the step that never ran in the build sandbox
npx prisma migrate dev --name init
npm run prisma:seed         # 8 demo products, 2 customers (one CREDIT), 2 suppliers, demo users per role
npm run dev                 # http://localhost:4000

cd ../frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Demo logins: `admin`/`Admin@12345`, `manager1`/`Manager@12345`, `cashier1`/`Cashier@12345`, `inventory1`/`Inventory@12345`, `accountant1`/`Accountant@12345`. Full API reference and printer setup instructions are in the root `README.md`.
