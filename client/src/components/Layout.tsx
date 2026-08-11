import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/patients', label: 'Patients', icon: '☰' },
  { to: '/sessions', label: 'Sessions & Attendance', icon: '✓' },
  { to: '/payments', label: 'Payments', icon: '₹' },
  { to: '/expenses', label: 'Expenses', icon: '▤' },
  { to: '/reports', label: 'Reports & P/L', icon: '◔' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gradient-to-b from-brand-900 to-brand-950 text-white transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 font-bold">
            P
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">PhysioCare</div>
            <div className="text-[11px] text-brand-200">Patient Management</div>
          </div>
        </div>

        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10'
                }`
              }
            >
              <span className="w-5 text-center text-xs opacity-80">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4">
          <div className="mb-3 text-sm">
            <div className="font-semibold">{user?.name}</div>
            <div className="text-[11px] text-brand-200">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-ink-100 bg-white/80 px-6 backdrop-blur">
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(true)}>
            ☰
          </button>
          <div className="text-sm text-ink-500">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
