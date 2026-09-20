import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
type User = {
  id: string;
  name: string;
  username: string;
  role: string;
  isActive: boolean;
};
export default function Users() {
  const { user } = useAuth();
  const allowed = user?.permissions.includes("users.manage");
  const [rows, setRows] = useState<User[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [roleName, setRole] = useState("CASHIER");
  const load = () =>
    apiRequest<User[]>("/users")
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/users", {
        method: "POST",
        body: { name, username, password, roleName },
      });
      setName("");
      setUsername("");
      setPassword("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(row: User) {
    setBusy(true);
    try {
      await apiRequest(
        `/users/${row.id}/${row.isActive ? "deactivate" : "activate"}`,
        { method: "PATCH" },
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!allowed)
    return (
      <p className="p-8">Your role does not have access to user management.</p>
    );
  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="text-sm text-ink/60">
        Create individual accounts for staff. Deactivated accounts cannot log in
        or refresh; existing access expires within 15 minutes by default.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5"
      >
        {[
          ["Name", name, setName],
          ["Username", username, setUsername],
          ["Password", password, setPassword],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="text-sm">
            {label as string}
            <input
              required
              minLength={
                label === "Password" ? 12 : label === "Username" ? 3 : 1
              }
              type={label === "Password" ? "password" : "text"}
              autoComplete="off"
              value={value as string}
              onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              className="mt-1 block rounded border p-2"
            />
          </label>
        ))}
        <label className="text-sm">
          Role
          <select
            value={roleName}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 block rounded border p-2"
          >
            {[
              "ADMIN",
              "MANAGER",
              "CASHIER",
              "INVENTORY_MANAGER",
              "ACCOUNTANT",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="rounded bg-ledger-600 px-4 py-2 text-white"
        >
          Create account
        </button>
      </form>
      <div className="rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["Name", "Username", "Role", "Status", ""].map((h, i) => (
                <th key={i} className="p-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-4">{r.name}</td>
                <td>{r.username}</td>
                <td>{r.role}</td>
                <td>{r.isActive ? "Active" : "Inactive"}</td>
                <td>
                  <button
                    disabled={busy || r.id === user?.id}
                    onClick={() => void toggle(r)}
                  >
                    {r.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
