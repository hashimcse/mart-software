import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permission.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { buildReport, reportQuery } from "../services/report.service";
import { ForbiddenError } from "../utils/errors";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export function csvCell(value: string) {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
const router = Router();
router.use(authenticate, requirePermission("reports.view"));
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = reportQuery.parse(req.query);
    const includeCosts = req.user!.permissions.includes("profits.view");
    if (q.kind === "financial" && !includeCosts)
      throw new ForbiddenError("Financial reports require profits.view");
    const report = await buildReport(q, includeCosts);
    if (q.format === "json") return res.json(report);
    const name = `${q.kind}-${q.from}-${q.to}`;
    if (q.format === "csv") {
      res.attachment(`${name}.csv`).type("text/csv");
      return res.send(
        "\uFEFF" +
          [report.columns, ...report.rows]
            .map((r) => r.map(csvCell).join(","))
            .join("\r\n"),
      );
    }
    if (q.format === "xlsx") {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet("Report");
      sheet.addRow([report.title]);
      sheet.addRow([report.period]);
      sheet.addRow([report.note]);
      sheet.addRow(report.columns);
      report.rows.forEach((r) => sheet.addRow(r));
      sheet.getRow(4).font = { bold: true };
      sheet.columns.forEach((c) => (c.width = 24));
      sheet.views = [{ state: "frozen", ySplit: 4 }];
      res.attachment(`${name}.xlsx`);
      return res.send(Buffer.from(await book.xlsx.writeBuffer()));
    }
    res.attachment(`${name}.pdf`).type("application/pdf");
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
    });
    doc.pipe(res);
    doc.fontSize(18).text(report.title);
    doc
      .fontSize(10)
      .text(report.period)
      .moveDown()
      .text(report.note)
      .moveDown();
    const width = (doc.page.width - 72) / report.columns.length;
    const row = (values: string[], bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      const height =
        Math.max(
          ...values.map((v) => doc.heightOfString(v, { width: width - 10 })),
        ) + 14;
      if (doc.y + height > doc.page.height - 40) doc.addPage();
      const y = doc.y;
      values.forEach((v, i) =>
        doc.text(v, 36 + i * width, y, { width: width - 10 }),
      );
      doc.y = y + height;
      doc.x = 36;
    };
    row(report.columns, true);
    report.rows.forEach((r) => row(r));
    doc.end();
  }),
);
export default router;
