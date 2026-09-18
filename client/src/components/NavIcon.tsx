/**
 * The navigation icons.
 *
 * These were typed characters — ☰ ✓ ✚ ₨ ▦ — which render differently on every machine and
 * look like placeholders because that is what they were. These are drawn instead: one stroke
 * weight, one grid, and each one says what its section is about rather than being decoration.
 */

export type NavIconName =
  | 'dashboard'
  | 'patients'
  | 'sessions'
  | 'calendar'
  | 'doctors'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'analytics'
  | 'settings'
  // Used on the dashboard tiles rather than in the sidebar.
  | 'trend'
  | 'alert'
  | 'package'
  | 'carry';

const paths: Record<NavIconName, JSX.Element> = {
  // Panels: the overview of everything at once.
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5" />
    </>
  ),
  // Two people: the patient list.
  patients: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.2a5.2 5.2 0 0 1 3 4.8" />
    </>
  ),
  // A calendar with a tick: sessions booked and marked.
  sessions: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <path d="M8.75 15.25l2.25 2.25 4.25-4.25" />
    </>
  ),
  // A calendar with a scatter of days: the month laid out at a glance, not one row at a time.
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // A stethoscope: the clinicians.
  doctors: (
    <>
      <path d="M5 3.5v4.5a4.5 4.5 0 0 0 9 0V3.5" />
      <path d="M3.2 3.5h3.4M12.4 3.5h3.4" />
      <path d="M9.5 12.5v2a5 5 0 0 0 5 5h1" />
      <circle cx="18" cy="17" r="2.6" />
    </>
  ),
  // A banknote: money coming in.
  payments: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 10.5v3M18 10.5v3" />
    </>
  ),
  // A wallet with a clasp: money going out.
  expenses: (
    <>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11.5a2 2 0 0 1 2 2v1" />
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M20.5 11.5h-3.75a2 2 0 0 0 0 4h3.75" />
    </>
  ),
  // Bars with a trend line: the reports.
  reports: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5v-6M11 20.5v-9.5M15.5 20.5v-4M20 20.5v-12" />
    </>
  ),
  // A magnifying glass over a pulse: looking closely at what the clinic's activity is made of,
  // next to Reports' plain bars for the money side.
  analytics: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M15 15l5.5 5.5" />
      <path d="M6.7 10.3l1.6-3 1.4 4.6 1.6-3.6 1.5 2" />
    </>
  ),
  // A cog, drawn simply enough to stay legible at 20px.
  settings: (
    <>
      <path d="M3.5 7h11M18.5 7h2M3.5 17h2M9.5 17h11" />
      <circle cx="16.5" cy="7" r="2.4" />
      <circle cx="7.5" cy="17" r="2.4" />
    </>
  ),
  // A line climbing: profit.
  trend: (
    <>
      <path d="M3.5 16.5l5.5-5.5 3.5 3.5 7-7" />
      <path d="M14.5 7.5h5v5" />
    </>
  ),
  // Money nobody has paid yet.
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.4v.1" />
    </>
  ),
  // A box: a course of treatment sold as one thing.
  package: (
    <>
      <path d="M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9L12 3z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </>
  ),
  // Pushed round to another day.
  carry: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 3.5v5h-5" />
    </>
  ),
};

export default function NavIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
