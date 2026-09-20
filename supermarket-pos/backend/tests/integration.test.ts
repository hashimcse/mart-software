import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";

test(
  "PostgreSQL integration suite",
  { skip: process.env.RUN_DB_TESTS !== "1" },
  async (t) => {
    assert.match(
      new URL(process.env.DATABASE_URL!).pathname,
      /test/,
      "Use a dedicated database with test in its name",
    );
    const { prisma } = await import("../src/config/database");
    const { createApp } = await import("../src/app");
    const server = createApp().listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}/api`;
    let token = "";
    async function req(path: string, body?: unknown, auth = token) {
      const response = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      return { status: response.status, data };
    }
    const id = randomUUID().slice(0, 8);
    let terminal: string,
      product: string,
      admin: string,
      session: string,
      sale: any;
    try {
      await t.test("login, role protection and malformed JSON", async () => {
        const login = await req(
          "/auth/login",
          { username: "admin", password: "Admin@12345" },
          "",
        );
        assert.equal(login.status, 200);
        token = login.data.accessToken;
        admin = login.data.user.id;
        assert.equal(
          (await req("/reports?from=2026-01-01&to=2026-01-02", undefined, ""))
            .status,
          401,
        );
        const cashier = await req(
          "/auth/login",
          { username: "cashier1", password: "Cashier@12345" },
          "",
        );
        assert.equal(
          (await req("/backups", undefined, cashier.data.accessToken)).status,
          403,
        );
        const malformed = await fetch(base + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        });
        assert.equal(malformed.status, 400);
        const refreshes = await Promise.all([
          req("/auth/refresh", { refreshToken: login.data.refreshToken }, ""),
          req("/auth/refresh", { refreshToken: login.data.refreshToken }, ""),
        ]);
        assert.deepEqual(refreshes.map((r) => r.status).sort(), [200, 401]);
      });
      const unit = await prisma.unit.findFirstOrThrow();
      terminal = (
        await prisma.terminal.create({ data: { name: `Test-${id}` } })
      ).id;
      product = (
        await prisma.product.create({
          data: {
            name: `Test product ${id}`,
            sku: `TEST-${id}`,
            barcode: `TEST-${id}`,
            unitId: unit.id,
            purchasePrice: "0.20",
            sellingPrice: "1.00",
            currentStock: "20",
          },
        })
      ).id;
      const cart = (
        qty = "1",
        discount = "0",
        payments = [{ method: "CASH", amount: "10.00" }],
      ) => ({
        terminalId: terminal,
        items: [{ productId: product, quantity: qty, discount: "0" }],
        discountAmount: discount,
        payments,
      });
      await t.test(
        "concurrent shift open permits exactly one session",
        async () => {
          const results = await Promise.all([
            req("/cash-sessions", { terminalId: terminal, openingCash: "50" }),
            req("/cash-sessions", { terminalId: terminal, openingCash: "50" }),
          ]);
          assert.equal(results.filter((r) => r.status === 201).length, 1);
          session = results.find((r) => r.status === 201)!.data.id;
        },
      );
      await t.test(
        "checkout stores applied cash, historical cost and transactional audit",
        async () => {
          const r = await req("/sales", cart("3", "0.01"));
          assert.equal(r.status, 201, JSON.stringify(r.data));
          sale = r.data.sale;
          assert.equal(sale.total, "2.99");
          assert.equal(r.data.changeDue, "7.01");
          assert.equal(sale.items[0].unitCost, "0.2");
          assert.equal(sale.payments[0].amount, "2.99");
          assert.equal(
            await prisma.auditLog.count({
              where: { entityId: sale.id, action: "SALE_COMPLETED" },
            }),
            1,
          );
        },
      );
      await t.test(
        "three partial refunds preserve the cart discount and round to paid total",
        async () => {
          let total = 0;
          for (let i = 0; i < 3; i++) {
            const r = await req("/returns", {
              saleId: sale.id,
              items: [
                { saleItemId: sale.items[0].id, quantity: "1", restock: true },
              ],
              refundMethod: "CASH",
            });
            assert.equal(r.status, 201, JSON.stringify(r.data));
            total += Math.round(Number(r.data.totalRefund) * 100);
          }
          assert.equal(total, 299);
          assert.equal(
            (await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } }))
              .status,
            "RETURNED",
          );
          const extra = await req("/returns", {
            saleId: sale.id,
            items: [{ saleItemId: sale.items[0].id, quantity: "1" }],
          });
          assert.equal(extra.status, 400);
        },
      );
      await t.test(
        "concurrent returns cannot refund the same unit twice",
        async () => {
          const s = (await req("/sales", cart())).data.sale;
          const body = {
            saleId: s.id,
            items: [{ saleItemId: s.items[0].id, quantity: "1" }],
          };
          const results = await Promise.all([
            req("/returns", body),
            req("/returns", body),
          ]);
          assert.equal(results.filter((r) => r.status === 201).length, 1);
        },
      );
      await t.test(
        "credit requires a customer and insufficient stock rolls back",
        async () => {
          const before = (
            await prisma.product.findUniqueOrThrow({ where: { id: product } })
          ).currentStock.toString();
          assert.equal(
            (
              await req(
                "/sales",
                cart("1", "0", [{ method: "CREDIT", amount: "1" }]),
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await req(
                "/sales",
                cart("999", "0", [{ method: "CASH", amount: "999" }]),
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await prisma.product.findUniqueOrThrow({ where: { id: product } })
            ).currentStock.toString(),
            before,
          );
        },
      );
      await t.test(
        "two terminals racing for last item cannot create negative stock",
        async () => {
          await prisma.product.update({
            where: { id: product },
            data: { currentStock: "1" },
          });
          const other = await prisma.terminal.create({
            data: { name: `Other-${id}` },
          });
          const results = await Promise.all([
            req("/sales", cart()),
            req("/sales", { ...cart(), terminalId: other.id }),
          ]);
          assert.equal(results.filter((r) => r.status === 201).length, 1);
          assert.equal(
            (
              await prisma.product.findUniqueOrThrow({ where: { id: product } })
            ).currentStock.toString(),
            "0",
          );
        },
      );
      await t.test("reports, filters and all export formats", async () => {
        const date = new Date().toISOString().slice(0, 10);
        const query = `from=${date}&to=${date}`;
        for (const group of [
          "day",
          "week",
          "month",
          "cashier",
          "product",
          "category",
          "customer",
          "payment",
        ])
          assert.equal(
            (await req(`/reports?${query}&group=${group}`)).status,
            200,
          );
        for (const kind of ["inventory", "financial"])
          assert.equal(
            (await req(`/reports?${query}&kind=${kind}`)).status,
            200,
          );
        assert.equal(
          (await req("/reports?from=2026-02-31&to=2026-03-01")).status,
          400,
        );
        for (const format of ["csv", "xlsx", "pdf"]) {
          const r = await fetch(`${base}/reports?${query}&format=${format}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          assert.equal(r.status, 200);
          const buf = Buffer.from(await r.arrayBuffer());
          if (format === "pdf")
            assert.equal(buf.subarray(0, 4).toString(), "%PDF");
          if (format === "xlsx")
            assert.equal(buf.subarray(0, 2).toString(), "PK");
          assert.ok(buf.length > 20);
        }
      });
      await t.test(
        "purchase receiving is atomic under concurrent requests",
        async () => {
          const supplier = await prisma.supplier.findFirstOrThrow();
          const po = await req("/purchases", {
            supplierId: supplier.id,
            items: [{ productId: product, quantity: "2", unitCost: "0.2" }],
          });
          assert.equal(po.status, 201, JSON.stringify(po.data));
          const result = await Promise.all([
            req(`/purchases/${po.data.id}/receive`, {}),
            req(`/purchases/${po.data.id}/receive`, {}),
          ]);
          assert.equal(result.filter((r) => r.status === 200).length, 1);
          assert.equal(
            (
              await prisma.product.findUniqueOrThrow({ where: { id: product } })
            ).currentStock.toString(),
            "2",
          );
        },
      );
      await t.test(
        "close shift reconciles applied cash and blocks later manual movements",
        async () => {
          const detail = await req(`/cash-sessions/${session}`);
          const r = await req(`/cash-sessions/${session}/close`, {
            actualCash: detail.data.expectedSoFar,
          });
          assert.equal(r.status, 200, JSON.stringify(r.data));
          assert.equal(r.data.difference, "0");
          assert.equal(
            (
              await req(`/cash-sessions/${session}/movements`, {
                type: "CASH_IN",
                amount: "1",
              })
            ).status,
            400,
          );
        },
      );
      await t.test('financial totals reconcile tax, cart discounts, returns and cost snapshots',async()=>{
        const {buildReport,reportQuery}=await import('../src/services/report.service');
        const date=new Date().toISOString().slice(0,10),query=reportQuery.parse({from:date,to:date,kind:'financial'});
        const before=await buildReport(query);
        const tax=await prisma.tax.create({data:{name:`Test tax ${id}`,rate:'17',isInclusive:false}});
        const item=await prisma.product.create({data:{name:`Taxed ${id}`,sku:`TAX-${id}`,unitId:unit.id,purchasePrice:'2',sellingPrice:'10',currentStock:'5',taxId:tax.id}});
        const r=await req('/sales',{terminalId:terminal,items:[{productId:item.id,quantity:'2'}],discountAmount:'2.34',payments:[{method:'CASH',amount:'30'}]});assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.sale.total,'21.06');
        await prisma.product.update({where:{id:item.id},data:{purchasePrice:'99'}});
        const returned=await req('/returns',{saleId:r.data.sale.id,items:[{saleItemId:r.data.sale.items[0].id,quantity:'1',restock:true}]});assert.equal(returned.status,201);assert.equal(returned.data.totalRefund,'10.53');
        const after=await buildReport(query);
        const delta=(key:string)=>Math.round((Number(after.summary[key])-Number(before.summary[key]))*100);
        assert.equal(delta('Revenue excluding tax'),900);assert.equal(delta('Net tax'),153);assert.equal(delta('Cost of goods sold'),200);assert.equal(delta('Gross profit'),700);
      });
      await t.test('split credit refunds reduce debt once and enforce the credit limit',async()=>{
        const customer=await prisma.customer.create({data:{name:`Credit test ${id}`,type:'CREDIT',creditLimit:'2'}});
        const item=await prisma.product.create({data:{name:`Credit item ${id}`,sku:`CREDIT-${id}`,unitId:unit.id,purchasePrice:'0.20',sellingPrice:'1',currentStock:'10'}});
        const body={terminalId:terminal,customerId:customer.id,items:[{productId:item.id,quantity:'2'}],payments:[{method:'CREDIT',amount:'1'},{method:'CREDIT',amount:'1'}]};
        const r=await req('/sales',body);assert.equal(r.status,201,JSON.stringify(r.data));
        assert.equal((await req('/sales',body)).status,400);
        const returned=await req('/returns',{saleId:r.data.sale.id,items:[{saleItemId:r.data.sale.items[0].id,quantity:'1'}],refundMethod:'CREDIT'});assert.equal(returned.status,201);
        const detail=await req(`/customers/${customer.id}`);assert.equal(detail.data.balance.outstandingBalance,'1.00');
        const cashReturn=await req('/returns',{saleId:r.data.sale.id,items:[{saleItemId:r.data.sale.items[0].id,quantity:'1'}],refundMethod:'CASH'});assert.equal(cashReturn.status,201);
        assert.equal((await req(`/customers/${customer.id}`)).data.balance.outstandingBalance,'1.00');
      });
      await t.test('image upload rejects HTML disguised with an image MIME type',async()=>{
        const form=new FormData();form.append('image',new Blob(['<html><script>alert(1)</script></html>'],{type:'image/png'}),'attack.html');
        const response=await fetch(`${base}/products/${product}/image`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});assert.equal(response.status,400);
        const valid=new FormData();valid.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'wrong.html');
        const accepted=await fetch(`${base}/products/${product}/image`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:valid});assert.equal(accepted.status,200);assert.match((await accepted.json()).imageUrl,/\.png$/);
      });
      await t.test('inventory reports hide costs from inventory staff',async()=>{
        const account=await req('/auth/login',{username:'inventory1',password:'Inventory@12345'},'');assert.equal(account.status,200);
        const date=new Date().toISOString().slice(0,10);const r=await req(`/reports?from=${date}&to=${date}&kind=inventory`,undefined,account.data.accessToken);assert.equal(r.status,200);assert.equal(r.data.columns.includes('Cost value'),false);
        assert.equal((await req(`/reports?from=${date}&to=${date}&kind=financial`,undefined,account.data.accessToken)).status,403);
      });
      await t.test(
        "barcode endpoint load sample: 100 requests, concurrency 10",
        async () => {
          const timings: number[] = [];
          for (let round = 0; round < 10; round++)
            await Promise.all(
              Array.from({ length: 10 }, async () => {
                const start = performance.now();
                const r = await req(`/products/barcode/TEST-${id}`);
                assert.equal(r.status, 200);
                timings.push(performance.now() - start);
              }),
            );
          timings.sort((a, b) => a - b);
          console.log(
            `BARCODE_LOAD count=100 concurrency=10 p50=${timings[49].toFixed(1)}ms p95=${timings[94].toFixed(1)}ms max=${timings[99].toFixed(1)}ms`,
          );
        },
      );
      await t.test(
        "pg_dump backup restores actual data into a separate PostgreSQL database",
        { skip: process.env.RUN_BACKUP_TESTS !== "1" },
        async () => {
          const { createBackup, restoreBackup } =
            await import("../src/services/backup.service");
          const { Client } = await import("pg");
          const backup = await createBackup("MANUAL", admin);
          assert.equal(backup.status, "COMPLETE");
          const restored = await restoreBackup(
            backup.id,
            "RESTORE TO NEW DATABASE",
            admin,
          );
          const url = new URL(process.env.DATABASE_URL!);
          url.pathname = "/" + restored.database;
          const client = new Client({ connectionString: url.toString() });
          await client.connect();
          try {
            assert.equal(
              (
                await client.query(
                  "SELECT count(*)::int AS n FROM products WHERE id=$1",
                  [product],
                )
              ).rows[0].n,
              1,
            );
            assert.equal(
              (
                await client.query("SELECT total FROM sales WHERE id=$1", [
                  sale.id,
                ])
              ).rows[0].total,
              "2.99",
            );
          } finally {
            await client.end();
          }
          console.log("RESTORE_VERIFIED " + restored.database);
        },
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.$disconnect();
    }
  },
);
