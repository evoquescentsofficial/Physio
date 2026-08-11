import React from 'react';

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm">
      <div
        className={`card my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} animate-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1 text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  ABSENT: 'bg-red-100 text-red-700',
  SCHEDULED: 'bg-brand-100 text-brand-700',
  CARRIED_FORWARD: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-ink-200 text-ink-600',
  ACTIVE: 'bg-brand-100 text-brand-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  ADVANCE: 'bg-violet-100 text-violet-700',
  SESSION_FEE: 'bg-brand-100 text-brand-700',
  INSTALLMENT: 'bg-cyan-100 text-cyan-700',
  VISIT_FEE: 'bg-sky-100 text-sky-700',
  REFUND: 'bg-red-100 text-red-700',
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${badgeStyles[value] || 'bg-ink-100 text-ink-600'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-ink-400">
      <div className="mb-2 text-3xl">◍</div>
      {message}
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent = 'brand',
  hint,
}: {
  label: string;
  value: string | number;
  accent?: 'brand' | 'emerald' | 'amber' | 'red';
  hint?: string;
}) {
  const accents: Record<string, string> = {
    brand: 'from-brand-500 to-brand-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-700',
  };
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${accents[accent]}`} />
      <div className="p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</div>
        <div className="mt-2 text-2xl font-bold text-ink-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
      </div>
    </Card>
  );
}

export function currency(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function toInputDate(d?: string | Date | null) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}
