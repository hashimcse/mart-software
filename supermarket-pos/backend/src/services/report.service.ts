import { prisma } from "../config/database";
import { Prisma } from "../generated/prisma";
import { z } from "zod";
import { ValidationError } from "../utils/errors";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v),
    "Invalid date",
  );
export const reportQuery = z
  .object({
    from: day,
    to: day,
    kind: z.enum(["sales", "inventory", "financial"]).default("sales"),
    group: z
      .enum([
        "day",
        "week",
        "month",
        "cashier",
        "product",
        "category",
        "customer",
        "payment",
      ])
      .default("day"),
    stock: z.enum(["all", "low", "out", "expired"]).default("all"),
    format: z.enum(["json", "csv", "xlsx", "pdf"]).default("json"),
  })
  .refine(
    (q) =>
      q.from <= q.to &&
      (Date.parse(q.to) - Date.parse(q.from)) / 86400000 <= 366,
    "Choose an ordered date range of at most 367 days",
  );
export type ReportQuery = z.infer<typeof reportQuery>;
export type Report = {
  title: string;
  period: string;
  note: string;
  columns: string[];
  rows: string[][];
  summary: Record<string, string>;
};
const D = Prisma.Decimal;
const sum = (values: Prisma.Decimal[]) =>
  values.reduce((a, b) => a.add(b), new D(0));

export async function buildReport(
  q: ReportQuery,
  includeCosts = true,
): Promise<Report> {
  const from = new Date(`${q.from}T00:00:00Z`),
    to = new Date(`${q.to}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  const range = { gte: from, lt: to };
  const period = `${q.from} through ${q.to} (UTC)`;
  return prisma.$transaction(
    async (tx): Promise<Report> => {
      if (q.kind === "inventory") {
        const products = await tx.product.findMany({
          include: { category: true },
          orderBy: { name: "asc" },
          take: 10001,
        });
        if (products.length > 10000)
          throw new ValidationError("Inventory report exceeds 10,000 products");
        const selected = products.filter(
          (p) =>
            q.stock === "all" ||
            (q.stock === "low" &&
              p.currentStock.gt(0) &&
              p.currentStock.lte(p.minStock)) ||
            (q.stock === "out" && p.currentStock.lte(0)) ||
            (q.stock === "expired" &&
              p.expiryDate &&
              p.expiryDate < new Date()),
        );
        const report: Report = {
          title: "Inventory",
          period: "Current snapshot",
          note: "Current stock and current purchase cost; date filters do not reconstruct historical stock.",
          columns: [
            "Product",
            "SKU",
            "Category",
            "Stock",
            "Minimum",
            "Expiry",
            "Cost value",
            "Retail value",
          ],
          rows: selected.map((p) => [
            p.name,
            p.sku,
            p.category?.name ?? "Uncategorized",
            p.currentStock.toFixed(3),
            p.minStock.toFixed(3),
            p.expiryDate?.toISOString().slice(0, 10) ?? "",
            p.currentStock.mul(p.purchasePrice).toFixed(2),
            p.currentStock.mul(p.sellingPrice).toFixed(2),
          ]),
          summary: {
            Products: String(selected.length),
            "Cost value": sum(
              selected.map((p) => p.currentStock.mul(p.purchasePrice)),
            ).toFixed(2),
            "Retail value": sum(
              selected.map((p) => p.currentStock.mul(p.sellingPrice)),
            ).toFixed(2),
          },
        };
        if (!includeCosts) {
          report.columns.splice(6, 1);
          report.rows.forEach((row) => row.splice(6, 1));
          delete report.summary["Cost value"];
          report.note =
            "Current stock snapshot. Date filters do not reconstruct historical stock.";
        }
        return report;
      }
      const sales = await tx.sale.findMany({
        where: { createdAt: range, status: { not: "CANCELLED" } },
        include: {
          items: { include: { product: { include: { category: true } } } },
          payments: true,
          cashier: { select: { name: true } },
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 10001,
      });
      const returns = await tx.return.findMany({
        where: { createdAt: range },
        include: { items: { include: { saleItem: true } }, sale: true },
        take: 10001,
      });
      if (sales.length > 10000 || returns.length > 10000)
        throw new ValidationError(
          "Report exceeds 10,000 transactions; use a shorter date range",
        );
      const grossSales = sum(sales.map((s) => s.total)),
        refunds = sum(returns.map((r) => r.totalRefund));
      if (q.kind === "financial") {
        const expense = await tx.expense.aggregate({
          where: { date: range },
          _sum: { amount: true },
        });
        // Cart discounts are allocated proportionally between revenue and tax.
        const taxes = sum(
          sales.map((s) =>
            s.subtotal.add(s.taxAmount).isZero()
              ? new D(0)
              : s.taxAmount.mul(s.total).div(s.subtotal.add(s.taxAmount)),
          ),
        );
        const returnedTaxes = sum(
          returns.map((r) =>
            r.sale.subtotal.add(r.sale.taxAmount).isZero()
              ? new D(0)
              : r.totalRefund
                  .mul(r.sale.taxAmount)
                  .div(r.sale.subtotal.add(r.sale.taxAmount)),
          ),
        );
        const missingCosts =
          sales.flatMap((s) => s.items).filter((i) => i.unitCost === null)
            .length +
          returns
            .flatMap((r) => r.items)
            .filter((i) => i.saleItem.unitCost === null).length;
        const cogs = sum(
          sales.flatMap((s) =>
            s.items.map((i) => (i.unitCost ?? new D(0)).mul(i.quantity)),
          ),
        ).sub(
          sum(
            returns.flatMap((r) =>
              r.items
                .filter((i) => i.restock)
                .map((i) => (i.saleItem.unitCost ?? new D(0)).mul(i.quantity)),
            ),
          ),
        );
        const netTax = taxes.sub(returnedTaxes),
          revenue = grossSales.sub(refunds).sub(netTax),
          expenses = expense._sum.amount ?? new D(0);
        const metrics: Record<string, string> = {
          "Sales including tax": grossSales.toFixed(2),
          "Refunds including tax": refunds.toFixed(2),
          "Net tax": netTax.toFixed(2),
          "Revenue excluding tax": revenue.toFixed(2),
          "Discounts granted": sum(sales.map((s) => s.discountAmount)).toFixed(
            2,
          ),
          "Cost of goods sold": missingCosts ? "Unavailable" : cogs.toFixed(2),
          "Gross profit": missingCosts
            ? "Unavailable"
            : revenue.sub(cogs).toFixed(2),
          Expenses: expenses.toFixed(2),
          "Net operating profit": missingCosts
            ? "Unavailable"
            : revenue.sub(cogs).sub(expenses).toFixed(2),
          "Lines missing historical costs": String(missingCosts),
        };
        return {
          title: "Financial report",
          period,
          note: "Accrual basis. Returns belong to their return date. Restocked returns reverse original cost; non-restocked goods remain an expense in COGS. Profit excludes other inventory write-offs, financing and income tax. Historical costs are never guessed.",
          columns: ["Metric", "Amount"],
          rows: Object.entries(metrics),
          summary: metrics,
        };
      }
      const groups = new Map<
        string,
        {
          label: string;
          count: Set<string>;
          quantity: Prisma.Decimal;
          amount: Prisma.Decimal;
        }
      >();
      function add(
        key: string,
        label: string,
        id: string,
        qty: Prisma.Decimal,
        amount: Prisma.Decimal,
      ) {
        const row = groups.get(key) ?? {
          label,
          count: new Set<string>(),
          quantity: new D(0),
          amount: new D(0),
        };
        row.count.add(id);
        row.quantity = row.quantity.add(qty);
        row.amount = row.amount.add(amount);
        groups.set(key, row);
      }
      for (const s of sales) {
        if (q.group === "payment") {
          for (const p of s.payments)
            add(p.method, p.method, s.id, new D(0), p.amount);
          continue;
        }
        if (q.group === "product" || q.group === "category") {
          const items = [...s.items].sort((a, b) => a.id.localeCompare(b.id));
          let allocated = new D(0);
          items.forEach((i, index) => {
            const gross = s.subtotal.add(s.taxAmount);
            const amount =
              index === items.length - 1
                ? s.total.sub(allocated)
                : gross.isZero()
                  ? new D(0)
                  : i.subtotal
                      .add(i.tax)
                      .mul(s.total)
                      .div(gross)
                      .toDecimalPlaces(2);
            allocated = allocated.add(amount);
            const key =
              q.group === "product"
                ? i.productId
                : (i.product.categoryId ?? "none");
            const label =
              q.group === "product"
                ? `${i.product.name} (${i.product.sku})`
                : (i.product.category?.name ?? "Uncategorized");
            add(key, label, s.id, i.quantity, amount);
          });
          continue;
        }
        let key = s.createdAt.toISOString().slice(0, 10),
          label = key;
        if (q.group === "month") key = label = key.slice(0, 7);
        if (q.group === "week") {
          const d = new Date(s.createdAt);
          d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
          key = label = d.toISOString().slice(0, 10);
        }
        if (q.group === "cashier") {
          key = s.cashierId;
          label = s.cashier.name;
        }
        if (q.group === "customer") {
          key = s.customerId ?? "walk-in";
          label = s.customer?.name ?? "Walk-in";
        }
        add(key, label, s.id, sum(s.items.map((i) => i.quantity)), s.total);
      }
      return {
        title: `Sales by ${q.group}`,
        period,
        note: "Sales include tax and discounts. Group rows show original sales; period refunds appear separately in the summary. Product and category labels reflect the current catalog.",
        columns: ["Group", "Transactions", "Quantity", "Sales"],
        rows: [...groups.values()].map((g) => [
          g.label,
          String(g.count.size),
          g.quantity.toFixed(3),
          g.amount.toFixed(2),
        ]),
        summary: {
          Transactions: String(sales.length),
          Sales: grossSales.toFixed(2),
          Refunds: refunds.toFixed(2),
          "Net sales": grossSales.sub(refunds).toFixed(2),
        },
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
