import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import Logo from './Logo';
import NavIcon, { NavIconName } from './NavIcon';
import { ConfirmDialog } from './ui';
import { IS_DEMO } from '../api/client';
import { resetDemoData } from '../api/demoAdapter';

const nav: { to: string; label: string; icon: NavIconName; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/patients', label: 'Patients', icon: 'patients' },
  { to: '/sessions', label: 'Sessions & Attendance', icon: 'sessions' },
  { to: '/doctors', label: 'Doctors', icon: 'doctors' },
  { to: '/payments', label: 'Payments', icon: 'payments' },
  { to: '/expenses', label: 'Expenses', icon: 'expenses' },
  { to: '/reports', label: 'Reports & P/L', icon: 'reports' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const clinicName = settings.clinicName;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 transform bg-gradient-to-b from-brand-900 to-brand-950 text-white transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[4.5rem] items-center gap-3 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-soft">
            <Logo className="h-7 w-7" color="#1d45c9" />
          </div>
          <div className="min-w-0">
            {/* Clinic names run long; two lines beats cutting one off. */}
            <div className="text-[13.5px] font-bold leading-[1.15] tracking-tight">
              {clinicName}
            </div>
            <div className="text-[11px] font-medium tracking-wide text-brand-300">
              Patient Management
            </div>
          </div>
        </div>

        <nav className="space-y-0.5 px-3 py-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? 'bg-white/[0.14] text-white'
                    : 'text-brand-100/80 hover:bg-white/[0.07] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* A marker on the active row, so the eye finds the current page at a glance. */}
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <NavIcon
                    name={item.icon}
                    className={`h-[18px] w-[18px] shrink-0 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
              {(user?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold leading-tight">{user?.name}</div>
              <div className="text-[11px] capitalize tracking-wide text-brand-300">
                {(user?.role || '').toLowerCase()}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-white/20"
          >
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-ink-100 bg-white/80 px-6 backdrop-blur">
          <button
            className="btn-ghost !px-2 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open the menu"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="text-sm text-ink-500">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </div>
          {IS_DEMO && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 sm:inline">
                DEMO — saved in this browser only
              </span>
              <button
                className="btn-secondary !py-1 !text-xs"
                onClick={() => setConfirmReset(true)}
              >
                Reset demo
              </button>
            </div>
          )}
        </header>
        <main className="p-6">
          <Outlet />
        </main>

        <ConfirmDialog
          open={confirmReset}
          title="Reset the demo?"
          message="Everything you have entered here is discarded and the original sample clinic comes back."
          confirmLabel="Reset demo"
          tone="primary"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            resetDemoData();
            window.location.reload();
          }}
        />
      </div>
    </div>
  );
}
