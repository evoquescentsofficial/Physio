/**
 * Browser-only backend for the demo build. It implements the same routes as the Express
 * API against data held in localStorage, so the whole app can be tried from a single
 * static page with no server, database or install.
 *
 * Only used when VITE_DEMO=1; the normal build talks to the real API over HTTP.
 */
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { buildDemoDb } from './demoData';
import { DemoDb } from './demoTypes';

const STORAGE_KEY = 'physio-demo-db-v1';

function load(): DemoDb {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DemoDb;
    } catch {
      /* fall through and rebuild */
    }
  }
  const fresh = buildDemoDb();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

let db: DemoDb = load();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function resetDemoData() {
  db = buildDemoDb();
  persist();
}

let counter = Date.now();
const newId = (prefix: string) => `${prefix}${(counter++).toString(36)}`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

function inRange(dateStr: string, from?: string, to?: string) {
  const d = new Date(dateStr).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to && d > new Date(to).getTime()) return false;
  return true;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

function lastNMonthKeys(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

const patientBrief = (patientId: string) => {
  const p = db.patients.find((x) => x.id === patientId);
  return p ? { name: p.name, phone: p.phone } : undefined;
};

/** Routes are matched on method + path; `body` is already-parsed JSON. */
function handle(method: string, path: string, params: any, body: any): any {
  const seg = path.split('/').filter(Boolean);

  // ---- auth ----
  if (path === '/auth/login' && method === 'post') {
    return {
      token: 'demo-token',
      user: { id: 'demo', name: 'Clinic Admin', email: body.email, role: 'ADMIN' },
    };
  }
  if (path === '/auth/me') {
    return { user: { id: 'demo', name: 'Clinic Admin', email: 'admin@physio.clinic', role: 'ADMIN' } };
  }

  // ---- settings ----
  if (path === '/settings') {
    if (method === 'put') {
      db.settings = { ...db.settings, ...body };
      persist();
    }
    return db.settings;
  }

  // ---- patients ----
  if (seg[0] === 'patients') {
    if (seg.length === 1 && method === 'get') {
      const q = (params?.q || '').toLowerCase();
      return db.patients
        .filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.phone.includes(q) ||
            (p.email || '').toLowerCase().includes(q)
        )
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((p) => ({
          ...p,
          _count: {
            visits: db.visits.filter((v) => v.patientId === p.id).length,
            packages: db.packages.filter((k) => k.patientId === p.id).length,
          },
        }));
    }
    if (seg.length === 1 && method === 'post') {
      const now = new Date().toISOString();
      const patient = {
        id: newId('pat_'),
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        address: body.address || null,
        dob: body.dob || null,
        gender: body.gender || null,
        occupation: body.occupation || null,
        referredBy: body.referredBy || null,
        bloodGroup: body.bloodGroup || null,
        emergencyContact: body.emergencyContact || null,
        notes: body.notes || null,
        createdAt: now,
        updatedAt: now,
      };
      db.patients.push(patient);
      persist();
      return patient;
    }
    const patientId = seg[1];
    if (seg.length === 2 && method === 'get') {
      const p = db.patients.find((x) => x.id === patientId);
      if (!p) throw { status: 404, error: 'Patient not found' };
      return {
        ...p,
        diagnoses: db.diagnoses
          .filter((d) => d.patientId === patientId)
          .sort((a, b) => b.date.localeCompare(a.date)),
        packages: db.packages
          .filter((k) => k.patientId === patientId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((k) => ({
            ...k,
            installments: db.installments
              .filter((i) => i.packageId === k.id)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
            visits: db.visits
              .filter((v) => v.packageId === k.id)
              .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
            payments: db.payments.filter((y) => y.packageId === k.id),
          })),
        payments: db.payments
          .filter((y) => y.patientId === patientId)
          .sort((a, b) => b.date.localeCompare(a.date)),
        visits: db.visits
          .filter((v) => v.patientId === patientId)
          .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
      };
    }
    if (seg.length === 2 && method === 'put') {
      const p = db.patients.find((x) => x.id === patientId)!;
      Object.assign(p, body, { updatedAt: new Date().toISOString() });
      persist();
      return p;
    }
    if (seg.length === 2 && method === 'delete') {
      db.patients = db.patients.filter((x) => x.id !== patientId);
      db.diagnoses = db.diagnoses.filter((x) => x.patientId !== patientId);
      const pkgIds = db.packages.filter((k) => k.patientId === patientId).map((k) => k.id);
      db.packages = db.packages.filter((k) => k.patientId !== patientId);
      db.installments = db.installments.filter((i) => !pkgIds.includes(i.packageId));
      db.visits = db.visits.filter((v) => v.patientId !== patientId);
      db.payments = db.payments.filter((y) => y.patientId !== patientId);
      persist();
      return null;
    }
  }

  // ---- diagnoses ----
  if (seg[0] === 'diagnoses') {
    if (seg.length === 1 && method === 'get') {
      return db.diagnoses
        .filter((d) => !params?.patientId || d.patientId === params.patientId)
        .sort((a, b) => b.date.localeCompare(a.date));
    }
    if (seg.length === 1 && method === 'post') {
      const d = {
        id: newId('dia_'),
        patientId: body.patientId,
        date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
        title: body.title,
        details: body.details || null,
        treatmentPlan: body.treatmentPlan || null,
        remarks: body.remarks || null,
        doctorName: body.doctorName || null,
      };
      db.diagnoses.push(d);
      persist();
      return d;
    }
    if (seg.length === 2 && method === 'put') {
      const d = db.diagnoses.find((x) => x.id === seg[1])!;
      Object.assign(d, body, body.date ? { date: new Date(body.date).toISOString() } : {});
      persist();
      return d;
    }
    if (seg.length === 2 && method === 'delete') {
      db.diagnoses = db.diagnoses.filter((x) => x.id !== seg[1]);
      persist();
      return null;
    }
  }

  // ---- packages & installments ----
  if (seg[0] === 'packages') {
    if (seg[1] === 'installments' && seg.length === 3) {
      const inst = db.installments.find((i) => i.id === seg[2]);
      if (method === 'put' && inst) {
        Object.assign(inst, body);
        if (body.status === 'PAID') {
          inst.paidDate = new Date().toISOString();
          const pkg = db.packages.find((k) => k.id === inst.packageId);
          if (pkg) {
            db.payments.push({
              id: newId('pay_'),
              patientId: pkg.patientId,
              packageId: pkg.id,
              visitId: null,
              amount: inst.amount,
              type: 'INSTALLMENT',
              method: 'CASH',
              date: new Date().toISOString(),
              notes: 'Installment marked paid',
            });
          }
        }
        persist();
        return inst;
      }
      if (method === 'delete') {
        db.installments = db.installments.filter((i) => i.id !== seg[2]);
        persist();
        return null;
      }
    }
    if (seg.length === 3 && seg[2] === 'installments' && method === 'post') {
      const inst = {
        id: newId('ins_'),
        packageId: seg[1],
        amount: body.amount,
        dueDate: new Date(body.dueDate).toISOString(),
        paidDate: null,
        status: 'PENDING',
        notes: body.notes || null,
      };
      db.installments.push(inst);
      persist();
      return inst;
    }
    if (seg.length === 1 && method === 'get') {
      return db.packages
        .filter((k) => !params?.patientId || k.patientId === params.patientId)
        .map((k) => ({
          ...k,
          patient: patientBrief(k.patientId),
          visits: db.visits.filter((v) => v.packageId === k.id),
          installments: db.installments.filter((i) => i.packageId === k.id),
          payments: db.payments.filter((y) => y.packageId === k.id),
        }));
    }
    if (seg.length === 1 && method === 'post') {
      const totalFee = body.totalSessions * body.feePerSession;
      const startDate = body.startDate ? new Date(body.startDate) : new Date();
      const pkg = {
        id: newId('pkg_'),
        patientId: body.patientId,
        diagnosisId: body.diagnosisId || null,
        title: body.title,
        totalSessions: body.totalSessions,
        feePerSession: body.feePerSession,
        totalFee,
        startDate: startDate.toISOString(),
        status: 'ACTIVE',
        notes: body.notes || null,
        createdAt: new Date().toISOString(),
      };
      db.packages.push(pkg);

      const advance = body.advanceAmount || 0;
      if (advance > 0) {
        db.payments.push({
          id: newId('pay_'),
          patientId: body.patientId,
          packageId: pkg.id,
          visitId: null,
          amount: advance,
          type: 'ADVANCE',
          method: body.advanceMethod || 'CASH',
          date: startDate.toISOString(),
          notes: `Advance for ${body.title}`,
        });
      }

      const count = body.installmentCount || 0;
      if (Array.isArray(body.installments)) {
        for (const i of body.installments) {
          db.installments.push({
            id: newId('ins_'),
            packageId: pkg.id,
            amount: i.amount,
            dueDate: new Date(i.dueDate).toISOString(),
            paidDate: null,
            status: 'PENDING',
            notes: null,
          });
        }
      } else if (count > 0) {
        const balance = Math.max(totalFee - advance, 0);
        const per = Math.floor(balance / count);
        for (let i = 0; i < count; i++) {
          const due = new Date(startDate);
          due.setMonth(due.getMonth() + i + 1);
          db.installments.push({
            id: newId('ins_'),
            packageId: pkg.id,
            amount: i === count - 1 ? balance - per * (count - 1) : per,
            dueDate: due.toISOString(),
            paidDate: null,
            status: 'PENDING',
            notes: null,
          });
        }
      }

      if (body.generateSchedule) {
        const freq = body.scheduleFrequencyDays ?? 2;
        for (let s = 0; s < body.totalSessions; s++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + s * freq);
          db.visits.push({
            id: newId('vis_'),
            patientId: body.patientId,
            packageId: pkg.id,
            diagnosisId: body.diagnosisId || null,
            sessionNumber: s + 1,
            scheduledDate: d.toISOString(),
            completedDate: null,
            type: 'SESSION',
            fee: body.feePerSession,
            feeCollected: false,
            attendance: 'SCHEDULED',
            carriedForward: false,
            carriedFromId: null,
            remarks: null,
            treatmentNotes: null,
          });
        }
      }
      persist();
      return pkg;
    }
    if (seg.length === 2 && method === 'put') {
      const pkg = db.packages.find((k) => k.id === seg[1])!;
      Object.assign(pkg, body);
      if (body.totalSessions !== undefined && body.feePerSession !== undefined) {
        pkg.totalFee = body.totalSessions * body.feePerSession;
      }
      persist();
      return pkg;
    }
    if (seg.length === 2 && method === 'delete') {
      db.packages = db.packages.filter((k) => k.id !== seg[1]);
      db.installments = db.installments.filter((i) => i.packageId !== seg[1]);
      db.visits = db.visits.filter((v) => v.packageId !== seg[1]);
      persist();
      return null;
    }
  }

  // ---- visits & attendance ----
  if (seg[0] === 'visits') {
    if (seg.length === 1 && method === 'get') {
      return db.visits
        .filter(
          (v) =>
            (!params?.patientId || v.patientId === params.patientId) &&
            (!params?.attendance || v.attendance === params.attendance) &&
            inRange(v.scheduledDate, params?.from, params?.to)
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
        .map((v) => ({
          ...v,
          patient: patientBrief(v.patientId),
          package: v.packageId
            ? { title: db.packages.find((k) => k.id === v.packageId)?.title || '' }
            : null,
        }));
    }
    if (seg.length === 1 && method === 'post') {
      const v = {
        id: newId('vis_'),
        patientId: body.patientId,
        packageId: body.packageId || null,
        diagnosisId: body.diagnosisId || null,
        sessionNumber: body.sessionNumber ?? null,
        scheduledDate: new Date(body.scheduledDate).toISOString(),
        completedDate: null,
        type: body.type || 'SESSION',
        fee: body.fee || 0,
        feeCollected: false,
        attendance: 'SCHEDULED',
        carriedForward: false,
        carriedFromId: null,
        remarks: body.remarks || null,
        treatmentNotes: body.treatmentNotes || null,
      };
      db.visits.push(v);
      persist();
      return v;
    }
    if (seg[1] === 'carry-forward-pending' && method === 'post') {
      const pending = db.visits
        .filter(
          (v) =>
            v.packageId === body.packageId &&
            ['SCHEDULED', 'ABSENT'].includes(v.attendance) &&
            new Date(v.scheduledDate) < startOfToday()
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      const created = pending.map((source, i) => {
        source.attendance = 'CARRIED_FORWARD';
        source.carriedForward = true;
        const d = new Date(body.newStartDate);
        d.setDate(d.getDate() + i * (body.frequencyDays || 2));
        const nv = {
          ...source,
          id: newId('vis_'),
          scheduledDate: d.toISOString(),
          completedDate: null,
          attendance: 'SCHEDULED',
          carriedForward: false,
          carriedFromId: source.id,
          remarks: `Carried forward from ${new Date(source.scheduledDate).toDateString()}`,
        };
        db.visits.push(nv);
        return nv;
      });
      persist();
      return { count: created.length, visits: created };
    }
    if (seg.length === 3 && seg[2] === 'attendance' && method === 'post') {
      const v = db.visits.find((x) => x.id === seg[1])!;
      v.attendance = body.status;
      v.completedDate = body.status === 'PRESENT' ? new Date().toISOString() : null;
      if (body.feeCollected !== undefined) v.feeCollected = body.feeCollected;
      persist();
      return v;
    }
    if (seg.length === 3 && seg[2] === 'carry-forward' && method === 'post') {
      const source = db.visits.find((x) => x.id === seg[1])!;
      source.attendance = 'CARRIED_FORWARD';
      source.carriedForward = true;
      const nv = {
        ...source,
        id: newId('vis_'),
        scheduledDate: new Date(body.newDate).toISOString(),
        completedDate: null,
        attendance: 'SCHEDULED',
        carriedForward: false,
        carriedFromId: source.id,
        remarks: `Carried forward from ${new Date(source.scheduledDate).toDateString()}`,
      };
      db.visits.push(nv);
      persist();
      return nv;
    }
    if (seg.length === 2 && method === 'put') {
      const v = db.visits.find((x) => x.id === seg[1])!;
      Object.assign(v, body);
      persist();
      return v;
    }
    if (seg.length === 2 && method === 'delete') {
      db.visits = db.visits.filter((x) => x.id !== seg[1]);
      persist();
      return null;
    }
  }

  // ---- payments ----
  if (seg[0] === 'payments') {
    if (seg.length === 1 && method === 'get') {
      return db.payments
        .filter(
          (p) =>
            (!params?.patientId || p.patientId === params.patientId) &&
            (!params?.packageId || p.packageId === params.packageId) &&
            (!params?.type || p.type === params.type) &&
            inRange(p.date, params?.from, params?.to)
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((p) => ({ ...p, patient: patientBrief(p.patientId) }));
    }
    if (seg.length === 1 && method === 'post') {
      const p = {
        id: newId('pay_'),
        patientId: body.patientId,
        packageId: body.packageId || null,
        visitId: body.visitId || null,
        amount: body.amount,
        type: body.type,
        method: body.method || 'CASH',
        date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
        notes: body.notes || null,
      };
      db.payments.push(p);
      if (p.visitId && ['SESSION_FEE', 'VISIT_FEE'].includes(p.type)) {
        const v = db.visits.find((x) => x.id === p.visitId);
        if (v) v.feeCollected = true;
      }
      persist();
      return p;
    }
    if (seg.length === 2 && method === 'put') {
      const p = db.payments.find((x) => x.id === seg[1])!;
      Object.assign(p, body);
      persist();
      return p;
    }
    if (seg.length === 2 && method === 'delete') {
      db.payments = db.payments.filter((x) => x.id !== seg[1]);
      persist();
      return null;
    }
  }

  // ---- expenses ----
  if (seg[0] === 'expenses') {
    if (seg.length === 1 && method === 'get') {
      return db.expenses
        .filter(
          (e) =>
            (!params?.category || e.category === params.category) &&
            inRange(e.date, params?.from, params?.to)
        )
        .sort((a, b) => b.date.localeCompare(a.date));
    }
    if (seg.length === 1 && method === 'post') {
      const e = {
        id: newId('exp_'),
        category: body.category,
        title: body.title,
        amount: body.amount,
        date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
        paidTo: body.paidTo || null,
        notes: body.notes || null,
      };
      db.expenses.push(e);
      persist();
      return e;
    }
    if (seg.length === 2 && method === 'put') {
      const e = db.expenses.find((x) => x.id === seg[1])!;
      Object.assign(e, body, body.date ? { date: new Date(body.date).toISOString() } : {});
      persist();
      return e;
    }
    if (seg.length === 2 && method === 'delete') {
      db.expenses = db.expenses.filter((x) => x.id !== seg[1]);
      persist();
      return null;
    }
  }

  // ---- reports ----
  if (seg[0] === 'reports') {
    const months = Number(params?.months) || 6;
    const keys = lastNMonthKeys(months);

    if (seg[1] === 'dashboard') {
      const now = new Date();
      const som = new Date(now.getFullYear(), now.getMonth(), 1);
      const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const sod = startOfToday();
      const eod = new Date(sod.getTime() + 86399000);

      const monthPayments = db.payments.filter(
        (p) => p.type !== 'REFUND' && new Date(p.date) >= som && new Date(p.date) <= eom
      );
      const monthExpenses = db.expenses.filter(
        (e) => new Date(e.date) >= som && new Date(e.date) <= eom
      );
      const monthRevenue = monthPayments.reduce((s, p) => s + p.amount, 0);
      const monthExpenseTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

      const outstandingDues = db.packages
        .filter((k) => k.status === 'ACTIVE')
        .reduce((sum, k) => {
          const paid = db.payments
            .filter((y) => y.packageId === k.id)
            .reduce((s, y) => s + y.amount, 0);
          return sum + Math.max(k.totalFee - paid, 0);
        }, 0);

      return {
        totalPatients: db.patients.length,
        activePackages: db.packages.filter((k) => k.status === 'ACTIVE').length,
        todaysVisits: db.visits
          .filter((v) => new Date(v.scheduledDate) >= sod && new Date(v.scheduledDate) <= eod)
          .map((v) => ({ ...v, patient: patientBrief(v.patientId) })),
        overduePendingSessions: db.visits.filter(
          (v) => v.attendance === 'SCHEDULED' && new Date(v.scheduledDate) < sod
        ).length,
        monthRevenue,
        monthExpenses: monthExpenseTotal,
        monthProfit: monthRevenue - monthExpenseTotal,
        outstandingDues,
      };
    }

    if (seg[1] === 'revenue') {
      const byMonth: Record<string, Record<string, number>> = {};
      for (const k of keys)
        byMonth[k] = { CHECKUP_FEE: 0, ADVANCE: 0, SESSION_FEE: 0, INSTALLMENT: 0, VISIT_FEE: 0 };
      for (const p of db.payments) {
        if (p.type === 'REFUND') continue;
        const k = monthKey(new Date(p.date));
        if (!byMonth[k] || byMonth[k][p.type] === undefined) continue;
        byMonth[k][p.type] += p.amount;
      }
      return keys.map((k) => ({
        month: monthLabel(k),
        total: Object.values(byMonth[k]).reduce((a, b) => a + b, 0),
        ...byMonth[k],
      }));
    }

    if (seg[1] === 'expenses-summary') {
      const byMonth: Record<string, number> = {};
      for (const k of keys) byMonth[k] = 0;
      const byCategory: Record<string, number> = {};
      for (const e of db.expenses) {
        const k = monthKey(new Date(e.date));
        if (byMonth[k] !== undefined) byMonth[k] += e.amount;
        if (keys.includes(k)) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      }
      return {
        series: keys.map((k) => ({ month: monthLabel(k), total: byMonth[k] })),
        byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total })),
      };
    }

    if (seg[1] === 'profit-loss') {
      const rev: Record<string, number> = {};
      const exp: Record<string, number> = {};
      for (const k of keys) {
        rev[k] = 0;
        exp[k] = 0;
      }
      for (const p of db.payments) {
        if (p.type === 'REFUND') continue;
        const k = monthKey(new Date(p.date));
        if (rev[k] !== undefined) rev[k] += p.amount;
      }
      for (const e of db.expenses) {
        const k = monthKey(new Date(e.date));
        if (exp[k] !== undefined) exp[k] += e.amount;
      }
      const rows = keys.map((k) => ({
        month: monthLabel(k),
        revenue: rev[k],
        expenses: exp[k],
        profit: rev[k] - exp[k],
      }));
      return {
        rows,
        totals: rows.reduce(
          (a, r) => ({
            revenue: a.revenue + r.revenue,
            expenses: a.expenses + r.expenses,
            profit: a.profit + r.profit,
          }),
          { revenue: 0, expenses: 0, profit: 0 }
        ),
      };
    }

    if (seg[1] === 'outstanding') {
      return db.packages
        .filter((k) => k.status === 'ACTIVE')
        .map((k) => {
          const paid = db.payments
            .filter((y) => y.packageId === k.id)
            .reduce((s, y) => s + y.amount, 0);
          const patient = db.patients.find((p) => p.id === k.patientId)!;
          return {
            packageId: k.id,
            patient: { id: patient.id, name: patient.name, phone: patient.phone },
            title: k.title,
            totalFee: k.totalFee,
            paid,
            due: Math.max(k.totalFee - paid, 0),
          };
        })
        .filter((o) => o.due > 0)
        .sort((a, b) => b.due - a.due);
    }
  }

  throw { status: 404, error: `Demo API has no handler for ${method.toUpperCase()} ${path}` };
}

export const demoAdapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase();
  // Some callers put the query inline in the url, others pass config.params — support both.
  const [rawPath, rawQuery] = (config.url || '').replace(/^\/api/, '').split('?');
  const params = { ...Object.fromEntries(new URLSearchParams(rawQuery || '')), ...config.params };
  const path = rawPath;
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};

  // a touch of latency so loading states behave like the real thing
  await new Promise((r) => setTimeout(r, 60));

  try {
    const data = handle(method, path, params, body);
    return {
      data,
      status: method === 'post' ? 201 : 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  } catch (err: any) {
    const status = err?.status || 500;
    const error: any = new Error(err?.error || 'Demo error');
    error.response = { status, data: { error: err?.error || 'Demo error' }, config };
    throw error;
  }
};
