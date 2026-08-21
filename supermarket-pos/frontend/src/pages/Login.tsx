import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    const redirectTo = (location.state as { from?: string })?.from ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-ledger-600 font-display text-lg font-semibold text-white">
            M
          </div>
          <h1 className="font-display text-xl font-semibold text-ink">ABC Mart</h1>
          <p className="text-sm text-ink/60">Sign in to your terminal</p>
        </div>

        {/* Receipt-styled card — the one signature visual moment on this screen */}
        <div className="rounded-t-xl border border-b-0 border-ink/10 bg-white px-6 pt-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4 pb-6">
            {error && <div className="rounded-md bg-brick-50 px-3 py-2 text-sm text-brick-600">{error}</div>}

            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-ink/80">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm text-ink focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink/80">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-ink/15 px-3 py-2 text-sm text-ink focus:border-ledger-500 focus:outline-none focus:ring-1 focus:ring-ledger-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-ledger-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-ledger-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        {/* Torn perforated edge, like tearing a receipt off the till */}
        <div
          className="h-4 w-full bg-white"
          style={{
            clipPath:
              'polygon(0% 0%, 4% 100%, 8% 0%, 12% 100%, 16% 0%, 20% 100%, 24% 0%, 28% 100%, 32% 0%, 36% 100%, 40% 0%, 44% 100%, 48% 0%, 52% 100%, 56% 0%, 60% 100%, 64% 0%, 68% 100%, 72% 0%, 76% 100%, 80% 0%, 84% 100%, 88% 0%, 92% 100%, 96% 0%, 100% 100%, 100% 0%)',
          }}
        />

        <p className="figure mt-4 text-center text-xs text-ink/40">
          demo — admin / Admin@12345 · cashier1 / Cashier@12345
        </p>
      </div>
    </div>
  );
}
