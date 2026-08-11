import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  currency,
  formatDate,
  toInputDate,
} from '../components/ui';
import { Expense, ExpenseCategory } from '../types';

const categories: ExpenseCategory[] = [
  'SALARY',
  'RENT',
  'UTILITIES',
  'EQUIPMENT',
  'MARKETING',
  'MAINTENANCE',
  'OTHER',
];

export default function Expenses() {
  const now = new Date();
  const [from, setFrom] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [category, setCategory] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const emptyForm = {
    category: 'SALARY' as ExpenseCategory,
    title: '',
    amount: 0,
    date: toInputDate(new Date()),
    paidTo: '',
    notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const res = await api.get('/expenses', {
      params: { from, to: to ? `${to}T23:59:59` : undefined, category: category || undefined },
    });
    setExpenses(res.data);
  }, [from, to, category]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount) };
    if (editing) await api.put(`/expenses/${editing.id}`, payload);
    else await api.post('/expenses', payload);
    setOpen(false);
    setForm(emptyForm);
    setEditing(null);
    load();
  }

  async function remove(x: Expense) {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/expenses/${x.id}`);
    load();
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = categories
    .map((c) => ({
      category: c,
      total: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0),
    }))
    .filter((c) => c.total > 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Salaries, rent, utilities and other clinic costs"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            + Add Expense
          </button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="From">
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card className="px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Total in range
          </div>
          <div className="mt-1 text-xl font-bold text-amber-600">{currency(total)}</div>
        </Card>
        {byCategory.slice(0, 3).map((c) => (
          <Card key={c.category} className="px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {c.category.charAt(0) + c.category.slice(1).toLowerCase()}
            </div>
            <div className="mt-1 text-xl font-bold text-ink-900">{currency(c.total)}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {expenses.length === 0 ? (
          <EmptyState message="No expenses recorded in this range" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Title</th>
                  <th className="px-5 py-3 font-semibold">Paid to</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {expenses.map((x) => (
                  <tr key={x.id} className="hover:bg-brand-50/40">
                    <td className="px-5 py-3 text-ink-700">{formatDate(x.date)}</td>
                    <td className="px-5 py-3">
                      <span className="badge bg-brand-100 text-brand-700">
                        {x.category.charAt(0) + x.category.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-800">{x.title}</td>
                    <td className="px-5 py-3 text-ink-600">{x.paidTo || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink-900">
                      {currency(x.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="btn-ghost !py-1"
                        onClick={() => {
                          setEditing(x);
                          setForm({
                            category: x.category,
                            title: x.title,
                            amount: x.amount,
                            date: toInputDate(x.date),
                            paidTo: x.paidTo || '',
                            notes: x.notes || '',
                          });
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-ghost !py-1 text-red-600 hover:bg-red-50"
                        onClick={() => remove(x)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Category">
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Therapist salary — August"
              required
            />
          </Field>
          <Field label="Amount">
            <input
              className="input"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Paid to">
            <input
              className="input"
              value={form.paidTo}
              onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
