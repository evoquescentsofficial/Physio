import React, { useEffect, useState } from 'react';

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

/** Small line icons, so row actions read as actions rather than a wall of blue words. */
export function Icon({ name, className = 'h-4 w-4' }: { name: 'edit' | 'trash' | 'plus' | 'check' | 'x'; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    edit: (
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 6.5l3 3" />
    ),
    trash: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6" />
        <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M5 13l4 4L19 7" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

/** An icon-only action. The label is still announced and shown on hover. */
export function IconButton({
  icon,
  label,
  onClick,
  tone = 'default',
  className = '',
}: {
  icon: 'edit' | 'trash' | 'plus' | 'check' | 'x';
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  className?: string;
}) {
  const tones = {
    default: 'text-ink-400 hover:bg-brand-50 hover:text-brand-700',
    danger: 'text-ink-400 hover:bg-red-50 hover:text-red-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${tones[tone]} ${className}`}
    >
      <Icon name={icon} />
    </button>
  );
}

/**
 * In-app confirmation. The browser's own confirm() is blocked inside sandboxed frames,
 * where a Delete button would appear to do nothing at all, so destructive actions ask here.
 * Errors from the action are shown in place rather than thrown away.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  tone = 'danger',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onCancel} title={title}>
      <div className="space-y-4">
        <div className="text-sm text-ink-700">{message}</div>
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={confirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
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
  CHECKUP_FEE: 'bg-teal-100 text-teal-700',
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
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
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
