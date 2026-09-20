import { useEffect, useState } from "react";
import { apiRequest, apiDownload } from "../lib/api";
import { useAuth } from "../context/AuthContext";
export type ReportData = {
  title: string;
  period: string;
  note: string;
  columns: string[];
  rows: string[][];
  summary: Record<string, string>;
};
export function SalesChart({ rows }: { rows: string[][] }) {
  const selected = rows.slice(-14),
    max = Math.max(1, ...selected.map((r) => Number(r[3])));
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5">
      <h2 className="mb-5 font-semibold">Sales trend</h2>
      {selected.length ? (
        <div
          className="flex h-48 items-end gap-2"
          role="img"
          aria-label="Sales chart; exact values are shown in the report table"
        >
          {selected.map((r, i) => (
            <div
              key={i}
              className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"
            >
              <span className="truncate text-xs" title={r[3]}>
                {r[3]}
              </span>
              <div
                className="mx-auto w-full max-w-12 rounded-t bg-ledger-600"
                style={{ height: `${Math.max(1, (Number(r[3]) / max) * 75)}%` }}
              />
              <span className="mt-2 truncate text-xs" title={r[0]}>
                {r[0].slice(5)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink/50">No sales in this period.</p>
      )}
    </div>
  );
}
export default function Reports() {
  const { user } = useAuth();
  const canView = user?.permissions.includes("reports.view");
  const canProfit = user?.permissions.includes("profits.view");
  const today = new Date().toISOString().slice(0, 10),
    month = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(month),
    [to, setTo] = useState(today),
    [kind, setKind] = useState("sales"),
    [group, setGroup] = useState("day"),
    [stock, setStock] = useState("all");
  const [report, setReport] = useState<ReportData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loadedQuery, setLoadedQuery] = useState("");
  const query = new URLSearchParams({
    from,
    to,
    kind,
    group,
    stock,
  }).toString();
  async function run() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      setReport(await apiRequest<ReportData>(`/reports?${query}`));
      setLoadedQuery(query);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (canView) void run();
  }, [canView]);
  async function download(format: string) {
    setBusy(true);
    try {
      await apiDownload(
        `/reports?${loadedQuery}&format=${format}`,
        `report.${format}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!canView)
    return <p className="p-8">Your role does not have access to reports.</p>;
  return (
    <div className="space-y-6 p-8">
      <header>
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-ink/60">
          Explore sales, stock and operating results. Dates use UTC.
        </p>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="flex flex-wrap items-end gap-4 rounded-xl border border-ink/10 bg-white p-5"
      >
        <label className="text-sm">
          Report
          <select
            aria-label="Report type"
            className="mt-1 block rounded border p-2"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="sales">Sales</option>
            <option value="inventory">Inventory</option>
            {canProfit && <option value="financial">Financial</option>}
          </select>
        </label>
        {kind !== "inventory" && (
          <>
            <label className="text-sm">
              From
              <input
                className="mt-1 block rounded border p-2"
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Through
              <input
                className="mt-1 block rounded border p-2"
                type="date"
                required
                min={from}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
        {kind === "sales" && (
          <label className="text-sm">
            Group by
            <select
              className="mt-1 block rounded border p-2"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {[
                "day",
                "week",
                "month",
                "cashier",
                "product",
                "category",
                "customer",
                "payment",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        )}
        {kind === "inventory" && (
          <label className="text-sm">
            Stock
            <select
              className="mt-1 block rounded border p-2"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            >
              {["all", "low", "out", "expired"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        )}
        <button
          disabled={busy}
          className="rounded bg-ledger-600 px-5 py-2 text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Run report"}
        </button>
      </form>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-700">
          {error}
        </p>
      )}
      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(report.summary)
              .slice(0, 8)
              .map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-ink/10 bg-white p-4"
                >
                  <p className="text-sm text-ink/50">{k}</p>
                  <p className="mt-2 text-xl font-semibold">{v}</p>
                </div>
              ))}
          </div>
          {report.title === "Sales by day" && <SalesChart rows={report.rows} />}
          <section className="rounded-xl border border-ink/10 bg-white p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-semibold">{report.title}</h2>
              <div className="flex gap-2">
                {["csv", "xlsx", "pdf"].map((f) => (
                  <button
                    key={f}
                    disabled={busy}
                    onClick={() => void download(f)}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm text-ink/60">{report.period}</p>
            <p className="my-3 text-sm text-ink/60">{report.note}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {report.columns.map((c) => (
                      <th key={c} className="border-b p-3">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((v, j) => (
                        <td key={j} className="border-b border-ink/5 p-3">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.rows.length && (
                <p className="p-5 text-ink/50">
                  No records match these filters.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
