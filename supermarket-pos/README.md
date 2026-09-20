# Start here

On Windows, **double-click Supermarket POS.exe**. It starts the local database and opens the POS in your default browser at http://localhost:4010. Keep the executable beside the `backend`, `frontend` and `launcher` folders; extract the whole ZIP first.

Requires Node.js 22.12+ (including npm) and PostgreSQL 14+ installed. First setup needs internet to install and build dependencies; subsequent launches reuse the installation. These runtimes are already installed on the development computer. This is a browser-app launcher, not an installer containing those runtimes.

Demo login: **admin / Admin@12345**. Local data persists in `.local`; closing the browser leaves the server running. For a real store, follow [DEPLOYMENT.md](docs/DEPLOYMENT.md). The alternative **START-DEMO.ps1** script requires PowerShell 7.2+.

## Added in this continuation

### WhatsApp receipts

After a sale, choose **Send on WhatsApp**, or choose **WhatsApp** in Recent sales. Review the receipt and enter/check the recipient's number, then choose **Open WhatsApp** and press Send there. Saved customer numbers are prefilled; walk-in numbers are used only for this receipt. Pakistani mobile numbers starting with 03 are converted to international format. Other countries require the country code. Very long receipts can be copied and pasted into the chat. Requires internet and WhatsApp; no messaging API or automatic sending is used.

Phone/receipt regression checks: with Node.js 22.18+ or 24, run `node --experimental-strip-types --test --test-isolation=none frontend/tests/whatsappReceipt.test.ts` from this folder.

- Reports by day/week/month/cashier/product/category/customer/payment, current stock reports and financial summaries. CSV, XLSX and PDF exports; dashboard sales chart.
- Manual and scheduled PostgreSQL backups, checksums, failure history, product-image copies and restore into a separate database.
- Staff account screen, configurable discount threshold, authentication hardening, transaction fixes and updated dependencies.
- Database migrations, persistent unit/integration tests, backup restore verification and Windows/LAN deployment instructions.

### New API endpoints

| Method | Endpoint | Permission |
|---|---|---|
| GET | /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&kind=sales&group=day&format=json | reports.view; financial/cost fields require profits.view |
| GET / POST | /api/backups | backup.manage |
| GET | /api/backups/:id/download | backup.manage |
| POST | /api/backups/:id/restore | backup.manage; confirmation body described in deployment guide |

# Supermarket POS & Store Management System

Production-oriented POS/store management system, built in phases. **Phases 1–13 are implemented; see docs/VERIFICATION.md for tested scope and operating limits** — architecture, full database schema, authentication, product/category/brand management, the POS screen, split payments, thermal receipt printing, inventory, purchases/suppliers, customers/loyalty, returns/refunds, and expenses/cash register. See `docs/ROADMAP.md` for what's next, and `docs/ARCHITECTURE.md` for how it's put together and exactly what has (and hasn't) been verified end-to-end.

## Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM 7 (Rust-free — no native binary), PostgreSQL, JWT auth
- **Frontend:** React, TypeScript, Tailwind CSS, Vite, React Router

## Prerequisites

- Node.js 22.12+
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
npm run prisma:deploy
npm run prisma:seed       # set SEED_DEMO=true for demo data, or INITIAL_ADMIN_PASSWORD for a clean store
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
- Returns: full or partial returns against a sale, refunded proportionally to what was actually paid (discount and tax included), with per-line restock-or-not and the over-return cap enforced even across multiple partial returns. Purchase returns too — sending received stock back to a supplier, adjusting both stock and what's owed.
- Audit logging on login, failed login, user changes, every catalog create/update/delete/status change, every completed sale, every settings change, every inventory movement, every purchase/supplier-payment action, every customer/loyalty change, and every return.
- React app: login screen, protected sidebar shell, Catalog, POS (with returns built in), Inventory, Purchases (with purchase returns built in), Customers, and Settings — all wired to the real API, no mocked data. Reports, Backups and Team are connected to the API.

## What's not built yet

See docs/DEPLOYMENT.md for explicit operating limits, historical-cost handling and store-site acceptance steps.

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

### Returns (Phase 8)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/sales/:saleId/returnable` | Bearer + `refunds.process` | per-line returnable quantity for a sale (accounts for prior partial returns) |
| GET | `/api/returns?page=&pageSize=&saleId=` | Bearer + `refunds.process` | paginated return history |
| GET | `/api/returns/:id` | Bearer + `refunds.process` | return detail |
| POST | `/api/returns` | Bearer + `refunds.process` | `{ saleId, items: [{saleItemId, quantity, restock?}], reason? }` — full or partial return, refunded proportionally |
| GET | `/api/purchases/:purchaseId/returnable` | Bearer + `purchases.manage` | per-line returnable quantity for a received purchase |
| POST | `/api/purchases/:id/returns` | Bearer + `purchases.manage` | `{ items: [{purchaseItemId, quantity}], reason? }` — send received stock back to the supplier |

### Cash register + expenses (Phase 9)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/cash-sessions/open?terminalId=` | Bearer + `cash_register.manage` | the terminal's currently open session, if any |
| GET | `/api/cash-sessions/:id` | Bearer + `cash_register.manage` | session detail with running expected cash and per-type movement totals |
| POST | `/api/cash-sessions` | Bearer + `cash_register.manage` | `{ terminalId, openingCash }` — open a shift (fails if one's already open there) |
| POST | `/api/cash-sessions/:id/movements` | Bearer + `cash_register.manage` | `{ type: CASH_IN\|CASH_OUT, amount, notes? }` |
| POST | `/api/cash-sessions/:id/close` | Bearer + `cash_register.manage` | `{ actualCash }` — computes expected cash and the difference |
| GET | `/api/expenses?page=&pageSize=&category=` | Bearer + `expenses.manage` | paginated expense list |
| POST | `/api/expenses` | Bearer + `expenses.manage` | `{ category, description?, amount, paymentMethod, cashSessionId? }` |

Sales and cash refunds automatically post a movement to whichever terminal has an open session — no extra step needed at checkout.

## Current release notes

Read [Deployment](docs/DEPLOYMENT.md), [Verification](docs/VERIFICATION.md), and [Handoff](docs/HANDOFF.md). The original Phase 9 documents are retained with a _PHASE9 suffix for provenance; their verification claims do not describe this release.
