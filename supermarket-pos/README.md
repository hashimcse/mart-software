# Supermarket POS & Store Management System

Production-oriented POS/store management system, built in phases. **This is Phase 1 through 7 of 13** — architecture, full database schema, authentication, product/category/brand management, the POS screen, split payments, thermal receipt printing, inventory, purchases/suppliers, and customers/loyalty. See `docs/ROADMAP.md` for what's next, and `docs/ARCHITECTURE.md` for how it's put together and exactly what has (and hasn't) been verified end-to-end.

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM 7 (Rust-free — no native binary), PostgreSQL, JWT auth
- **Frontend:** React, TypeScript, Tailwind CSS, Vite, React Router

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (running locally or reachable over your network)

## Setup

### 1. Database

Create a database and user (adjust names/password as you like):

```sql
CREATE USER pos_user WITH PASSWORD 'pos_password';
CREATE DATABASE pos_db OWNER pos_user;
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # then edit DATABASE_URL and ACCESS_TOKEN_SECRET
npm install
npx prisma generate       # downloads a small schema-parsing tool on first run — needs normal internet access
npx prisma migrate dev --name init
npm run prisma:seed       # also seeds 8 demo products, 2 customers (one on credit), 2 suppliers
npm run verify:auth       # optional: exercises JWT/password/token logic with no DB needed
npm run dev
```

The API listens on `http://localhost:4000` (`/api/health` should return `{"status":"ok"}`). Uploaded product images are saved to `backend/uploads/` and served from `/uploads/...` — that folder is created automatically and is gitignored.

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # points at the backend above by default
npm install
npm run dev
```

Open `http://localhost:5173`.

## Demo logins

Seeded by `npm run prisma:seed`. **Change these before any real use.**

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@12345` |
| Manager | `manager1` | `Manager@12345` |
| Cashier | `cashier1` | `Cashier@12345` |
| Inventory Manager | `inventory1` | `Inventory@12345` |
| Accountant | `accountant1` | `Accountant@12345` |

## What's implemented right now

- Full database schema — every table from the spec (products, sales, inventory, purchases, suppliers, customers, returns, expenses, cash sessions, audit logs, settings, and more), as `backend/prisma/schema.prisma`.
- Auth: login, refresh-token rotation, logout, `/auth/me`.
- RBAC: 5 roles, ~20 permissions, enforced via middleware.
- Basic user management (admin can list/create/activate/deactivate users).
- Product catalog: full CRUD for products, categories (with parent/child hierarchy), brands, and units, with server-side search/filter/pagination, barcode/SKU uniqueness enforced at the database level, price changes gated behind a separate permission from other edits, and local image upload.
- POS screen: scan-or-search product entry, live cart with per-line discounts and stock warnings, hold/resume bills, customer picker with quick-add, keyboard shortcuts (F1/F2/F4/F5/F8/Delete), and real checkout — atomic invoice numbering, race-safe stock deduction, decimal-safe tax math, discount-amount permission gating.
- Split payments — any mix of cash/card/bank transfer/mobile wallet/credit, cash covers the remainder and can produce change.
- Receipt printing: real ESC/POS byte generation dispatched to a network printer (raw TCP, port 9100), or a browser-native print dialog sized for 58mm/80mm paper for printers installed as a system printer. Print/reprint from the post-sale screen and the recent-sales list.
- Settings page for store info and printer configuration (paper width, browser vs. network mode, printer IP/port, test print).
- Inventory: stock adjustments (with a direction + required reason), damaged/expired write-offs, a filterable/paginated movement ledger, low-stock/out-of-stock/expiring-soon alerts, and a stock valuation report (cost basis, retail value, potential profit). The Dashboard's metrics are real numbers now, not placeholders.
- Purchases: full purchase-order workflow (order → receive → invoice → pay), with stock only increasing once a PO is actually received. Supplier records with a computed (never stored) outstanding balance, and a payment history.
- Customers: full records (walk-in/registered/credit) with purchase history, a computed credit balance, payment recording, and loyalty points that accrue automatically at checkout and can be manually adjusted. The Dashboard's four metrics are all real numbers now — nothing left as a placeholder.
- Audit logging on login, failed login, user changes, every catalog create/update/delete/status change, every completed sale, every settings change, every inventory movement, every purchase/supplier-payment action, and every customer/loyalty change.
- React app: login screen, protected sidebar shell, Catalog, POS, Inventory, Purchases, Customers, and Settings — all wired to the real API, no mocked data. Only Reports remains a "not built yet" placeholder.

## What's not built yet

Returns, reports beyond the dashboard/inventory numbers already in place, cash register shifts, backups. The schema already supports all of it; each phase adds the services/routes/UI on top.

## Printer setup

**Browser mode (default)** — install your thermal printer as a normal system printer (most receipt printers, e.g. Epson TM-series, ship a driver; on Linux/CUPS the generic "Text Only" driver works for many). No further config needed — "Print receipt" opens a browser print window sized exactly for the paper width set in Settings.

**Network mode** — for a printer with an Ethernet/WiFi interface that accepts raw ESC/POS on a TCP port (almost always 9100 — check your printer's manual). In Settings, switch to "Network", enter the printer's IP and port, save, and use "Send test print" to confirm connectivity before relying on it at checkout.

**Raw file for USB-only printers** — `GET /api/sales/:id/receipt.escpos` returns the exact receipt bytes as a binary download. On Linux, `curl -H "Authorization: Bearer <token>" .../receipt.escpos > /dev/usb/lp0` (or wherever your printer is mounted) sends it directly — no bridge app needed if the backend runs on the same machine the printer is plugged into.

## API quick reference

### Auth (Phase 1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | — | `{ username, password }` → tokens + user |
| POST | `/api/auth/refresh` | — | `{ refreshToken }` → new token pair |
| POST | `/api/auth/logout` | — | `{ refreshToken }` → revoke |
| GET | `/api/auth/me` | Bearer | current user + permissions |
| GET | `/api/users` | Bearer + `users.manage` | list users |
| POST | `/api/users` | Bearer + `users.manage` | create user |
| PATCH | `/api/users/:id/activate` | Bearer + `users.manage` | reactivate |
| PATCH | `/api/users/:id/deactivate` | Bearer + `users.manage` | deactivate |

### Catalog (Phase 2)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/products?page=&pageSize=&search=&categoryId=&brandId=&status=` | Bearer + `products.view` | paginated, filtered product list |
| GET | `/api/products/barcode/:barcode` | Bearer + `products.view` | fast single-product lookup by barcode |
| GET | `/api/products/:id` | Bearer + `products.view` | product detail |
| POST | `/api/products` | Bearer + `products.edit` | create product |
| PATCH | `/api/products/:id` | Bearer + `products.edit` (+ `products.price.edit` if the body touches price fields) | update product |
| PATCH | `/api/products/:id/status` | Bearer + `products.edit` | ACTIVE / INACTIVE / DISCONTINUED |
| POST | `/api/products/:id/image` | Bearer + `products.edit` | multipart `image` field, JPEG/PNG/WebP, 5MB max |
| GET / POST / PATCH / DELETE | `/api/categories` | Bearer + `products.view` or `products.edit` | category CRUD (delete blocked if products/subcategories are attached) |
| GET / POST / PATCH / DELETE | `/api/brands` | Bearer + `products.view` or `products.edit` | brand CRUD (delete blocked if products are attached) |
| GET / POST | `/api/units` | Bearer + `products.view` or `products.edit` | list/create units of measure |

### POS + billing (Phase 3 + 4)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/terminals` | Bearer | list active terminals |
| GET | `/api/customers?search=` | Bearer + `customers.manage` | search customers |
| POST | `/api/customers` | Bearer + `customers.manage` | quick-add a customer |
| GET | `/api/sales?page=&pageSize=&terminalId=` | Bearer + `sales.create` | paginated sale history |
| GET | `/api/sales/:id` | Bearer + `sales.create` | sale detail (line items, payments) |
| POST | `/api/sales` | Bearer + `sales.create` | complete a sale — see body shape below |
| GET | `/api/sales/:id/receipt.escpos` | Bearer + `sales.create` | raw ESC/POS receipt bytes (binary download) |
| POST | `/api/sales/:id/print` | Bearer + `sales.create` | send the receipt to the configured network printer |
| GET | `/api/held-bills?terminalId=` | Bearer + `sales.create` | list parked carts for a terminal |
| POST | `/api/held-bills` | Bearer + `sales.create` | park the current cart |
| DELETE | `/api/held-bills/:id` | Bearer + `sales.create` | resume (delete after reading) or discard a held bill |
| GET | `/api/settings` | Bearer | store info + printer config (any authenticated user — receipts need it) |
| PUT | `/api/settings/:key` | Bearer + `settings.manage` | update one setting |
| POST | `/api/settings/test-print` | Bearer + `settings.manage` | send a test page to the configured network printer |

`POST /api/sales` body (payments is an array — split across any mix of methods):
```json
{
  "terminalId": "uuid",
  "customerId": "uuid or null",
  "items": [{ "productId": "uuid", "quantity": "2", "discount": "0.00" }],
  "discountAmount": "0.00",
  "payments": [
    { "method": "CARD", "amount": "300.00" },
    { "method": "CASH", "amount": "500.00" }
  ]
}
```
Returns `{ sale, changeDue }`. Quantities/discounts/amounts are strings, not numbers — see `docs/ARCHITECTURE.md` for why. Non-cash lines are charged exactly as stated; at most one `CASH` line is allowed and it covers whatever's left after non-cash payments, so it can exceed that remainder to produce change.

### Inventory (Phase 5)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/inventory/movements?page=&pageSize=&productId=&type=` | Bearer + `inventory.manage` or `reports.view` | paginated, filterable movement ledger |
| GET | `/api/inventory/low-stock` | Bearer + `inventory.manage` or `reports.view` | products at or below their minimum stock (and above zero) |
| GET | `/api/inventory/out-of-stock` | Bearer + `inventory.manage` or `reports.view` | products at zero stock |
| GET | `/api/inventory/expiring?days=14` | Bearer + `inventory.manage` or `reports.view` | products expiring within N days |
| GET | `/api/inventory/valuation` | Bearer + `inventory.manage` or `profits.view` | stock value at cost and retail, potential profit |
| POST | `/api/inventory/adjustments` | Bearer + `inventory.adjust` | `{ productId, quantityChange, reason }` — signed string, e.g. `"-5"`; reason required |
| POST | `/api/inventory/damaged` | Bearer + `inventory.manage` | `{ productId, quantity, reason? }` — always removes stock |
| POST | `/api/inventory/expired` | Bearer + `inventory.manage` | `{ productId, quantity, reason? }` — always removes stock |
| GET | `/api/dashboard/summary` | Bearer | today's sales total/count, low-stock count, out-of-stock count |

### Purchases + suppliers (Phase 6)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/suppliers?page=&pageSize=&search=` | Bearer + `suppliers.manage` | paginated supplier list, each with a computed balance |
| GET | `/api/suppliers/:id` | Bearer + `suppliers.manage` | supplier detail + recent purchases/payments |
| POST | `/api/suppliers` | Bearer + `suppliers.manage` | create supplier |
| PATCH | `/api/suppliers/:id` | Bearer + `suppliers.manage` | update supplier |
| POST | `/api/suppliers/:id/payments` | Bearer + `suppliers.manage` or `purchases.manage` | `{ amount, method, purchaseId? }` — pay down a balance, optionally against one PO |
| GET | `/api/purchases?page=&pageSize=&supplierId=&status=` | Bearer + `purchases.manage` | paginated purchase order list |
| GET | `/api/purchases/:id` | Bearer + `purchases.manage` | purchase detail (items, payments) |
| POST | `/api/purchases` | Bearer + `purchases.manage` | create a PO — `{ supplierId, items: [{productId, quantity, unitCost}], taxAmount? }`, status `ORDERED`; does not touch stock |
| POST | `/api/purchases/:id/receive` | Bearer + `purchases.manage` | ORDERED → RECEIVED; increments stock and writes `PURCHASE` inventory movements |
| POST | `/api/purchases/:id/invoice` | Bearer + `purchases.manage` | RECEIVED → INVOICED |
| POST | `/api/purchases/:id/cancel` | Bearer + `purchases.manage` | ORDERED → CANCELLED only (once received, use a purchase return instead — not yet built) |

### Customers + loyalty (Phase 7)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/customers?page=&pageSize=&search=&type=` | Bearer + `customers.manage` | paginated, filtered customer list, each with a computed credit balance |
| GET | `/api/customers/:id` | Bearer + `customers.manage` | customer detail + purchase history + payment history |
| POST | `/api/customers` | Bearer + `customers.manage` | create customer |
| PATCH | `/api/customers/:id` | Bearer + `customers.manage` | update customer |
| POST | `/api/customers/:id/payments` | Bearer + `customers.manage` | `{ amount, method, notes? }` — pay down a credit balance |
| POST | `/api/customers/:id/loyalty-adjustments` | Bearer + `customers.manage` | `{ pointsChange, reason }` — signed integer; also how redemption is recorded |

`POST /api/sales`'s response now also includes `loyaltyPointsEarned` — points accrue automatically for any sale with a customer attached, at a rate set in Settings (`loyalty.enabled`, `loyalty.pointsPerHundred`).

## Known items

- `npm audit` flags an esbuild dev-server-only advisory in the frontend toolchain (fixable only via a Vite major-version bump). It affects `vite dev` accepting cross-origin requests, not the production build output. Left as-is rather than force an untested breaking upgrade — revisit in Phase 12 (security/performance hardening).
- `npm audit` also flags a stack-exhaustion (DoS) advisory in `deepmerge-ts`, a transitive devDependency of `prisma`'s config parser — not shipped in the running backend (`@prisma/client` doesn't depend on it). No fix exists yet at the current latest Prisma version (7.9.1); the only suggested "fix" downgrades to Prisma 6.12.0, which would undo the Rust-free architecture change made specifically to avoid this sandbox's — and possibly some real deployments' — network restriction on `binaries.prisma.sh` (see docs/ARCHITECTURE.md). Left as-is; low real-world risk for a locally-run dev/build tool.
- Login's timing isn't fully constant-time between "user doesn't exist" and "wrong password" — noted in `auth.service.ts` as a candidate for the Phase 12 hardening pass.
