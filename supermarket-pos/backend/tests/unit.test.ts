import test from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL ??= "postgresql://unused@localhost/pos_test";
process.env.ACCESS_TOKEN_SECRET ??=
  "test-only-secret-012345678901234567890123456789";

test("export CSV quotes embedded text and neutralizes spreadsheet formulas", async () => {
  const { csvCell } = await import("../src/routes/report.routes");
  assert.equal(csvCell('hello,"world"'), '"hello,""world"""');
  for (const value of ["=1+1", "+cmd", "-cmd", "@SUM(A1)", "\t=cmd"])
    assert.ok(csvCell(value).startsWith("\"'"));
});
test("report dates reject rollover, reversed and excessive ranges", async () => {
  const { reportQuery } = await import("../src/services/report.service");
  for (const [from, to] of [
    ["2026-02-31", "2026-03-01"],
    ["2026-09-02", "2026-09-01"],
    ["2020-01-01", "2026-01-01"],
  ])
    assert.equal(reportQuery.safeParse({ from, to }).success, false);
  assert.equal(
    reportQuery.safeParse({ from: "2024-02-29", to: "2024-02-29" }).success,
    true,
  );
});
test("checkout rejects zero, negative and non-string quantities", async () => {
  const { saleItemSchema } = await import("../src/schemas/sale.schema");
  for (const quantity of ["0", "0.000", "-1", 1])
    assert.equal(
      saleItemSchema.safeParse({
        productId: "42b4be67-4943-4a86-8d50-24e7b58e01a1",
        quantity,
      }).success,
      false,
    );
  assert.equal(
    saleItemSchema.safeParse({
      productId: "42b4be67-4943-4a86-8d50-24e7b58e01a1",
      quantity: "0.125",
    }).success,
    true,
  );
});
