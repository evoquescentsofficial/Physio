import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@physio.clinic');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold">
            P
          </div>
          <span className="text-lg font-bold">PhysioCare</span>
        </div>
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">
            Everything your physiotherapy practice needs, in one place.
          </h1>
          <p className="mt-4 max-w-md text-brand-200">
            Patients, diagnoses, session packages, attendance, advances, installments, expenses and
            profit &amp; loss — all tracked automatically.
          </p>
        </div>
        <div className="text-sm text-brand-300">© {new Date().getFullYear()} PhysioCare</div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-ink-50 p-8">
        <form onSubmit={handleSubmit} className="card w-full max-w-md p-8">
          <h2 className="text-2xl font-bold text-ink-900">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-500">Sign in to manage your clinic.</p>

          {error && (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
