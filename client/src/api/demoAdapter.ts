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
import { accountPosition, installmentStatus, netAmount, splitInstallments } from '../../../shared/money';
import { addCycles, frequencyForCycle, isRecurring, planCycles } from '../../../shared/packages';
import { computeDoctorEarnings, salaryPeriod, salaryTag } from '../../../shared/commission';
import {
  canCarryForward,
  carryForwardBlockedReason,
  nextSessionNumber,
} from '../../../shared/sessions';

// Bump when the stored shape changes, so browsers holding an older demo database
// rebuild it instead of crashing on fields that did not exist then.
const STORAGE_KEY = 'physio-demo-db-v4';

function load(): DemoDb {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoDb;
      if (Array.isArray(parsed.patients) && Array.isArray(parsed.doctors)) return parsed;
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // A browser store is a few megabytes; attached scans are what fills it. Say so rather
    // than failing silently and losing whatever was just entered.
    throw {
      status: 507,
      error:
        'This browser has run out of space for the demo — usually an attached report. Remove a file, or press Reset demo.',
    };
  }
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

/** Mirrors resolveRange/bucket* in the server's reports route. */
function resolveRange(params: any) {
  const to = params?.to ? new Date(params.to) : new Date();
  to.setHours(23, 59, 59, 999);
  let from: Date;
  if (params?.from) {
    from = new Date(params.from);
  } else {
    const days = Math.max(1, Number(params?.days) || 30);
    from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
  }
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

type Bucket = 'day' | 'week' | 'month';

function bucketFor(from: Date, to: Date): Bucket {
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

function bucketKey(d: Date, bucket: Bucket) {
  if (bucket === 'month') return monthKey(d);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (bucket === 'week') day.setDate(day.getDate() - day.getDay());
  return day.toISOString().slice(0, 10);
}

function bucketLabel(key: string, bucket: Bucket) {
  if (bucket === 'month') return monthLabel(key);
  const label = new Date(key).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return bucket === 'week' ? `w/c ${label}` : label;
}

function bucketKeys(from: Date, to: Date, bucket: Bucket) {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  if (bucket === 'week') cursor.setDate(cursor.getDate() - cursor.getDay());
  if (bucket === 'month') cursor.setDate(1);
  while (cursor <= to) {
    keys.push(bucketKey(cursor, bucket));
    if (bucket === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (bucket === 'week') cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

/**
 * Payments falling due within `days`, plus anything already overdue — the reminder list.
 * Mirrors /reports/due-payments on the server.
 */
function dueInstallments(days: number) {
  const horizon = new Date();
  horizon.setHours(23, 59, 59, 999);
  horizon.setDate(horizon.getDate() + days);
  const today = startOfToday();

  return db.installments
    .filter((i) => !i.paidDate && new Date(i.dueDate) <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((i) => {
      const pkg = db.packages.find((k) => k.id === i.packageId);
      const patient = db.patients.find((p) => p.id === pkg?.patientId);
      const due = new Date(i.dueDate);
      due.setHours(0, 0, 0, 0);
      return {
        id: i.id,
        amount: i.amount,
        dueDate: i.dueDate,
        daysAway: Math.round((due.getTime() - today.getTime()) / 86400000),
        overdue: due < today,
        packageId: pkg?.id || '',
        packageTitle: pkg?.title || '',
        billingCycle: pkg?.billingCycle || 'ONE_TIME',
        patient: patient
          ? { id: patient.id, name: patient.name, phone: patient.phone }
          : { id: '', name: 'Unknown', phone: '' },
      };
    })
    .filter((r) => r.packageId);
}

/** Mirrors the server's account calculation — see computeAccounts in reports.routes.ts. */
function computeAccounts() {
  return db.patients.map((p) => ({
    patient: { id: p.id, name: p.name, phone: p.phone },
    ...accountPosition(
      db.packages.filter((k) => k.patientId === p.id),
      db.payments.filter((y) => y.patientId === p.id)
    ),
  }));
}

const doctorBrief = (doctorId: string | null) => {
  if (!doctorId) return null;
  const d = db.doctors.find((x) => x.id === doctorId);
  return d ? { id: d.id, name: d.name } : null;
};

/** Attachments live in their own table, the way the API returns them with a diagnosis. */
const withAttachments = <T extends { id: string }>(d: T) => ({
  ...d,
  attachments: db.attachments
    .filter((a) => a.diagnosisId === d.id)
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
});

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

  // ---- doctors ----
  if (seg[0] === 'doctors') {
    const withStats = (d: any) => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      return {
        ...d,
        sessionsThisMonth: db.visits.filter(
          (v) => v.doctorId === d.id && new Date(v.scheduledDate) >= startOfMonth
        ).length,
        sessionsCompleted: db.visits.filter(
          (v) => v.doctorId === d.id && v.attendance === 'PRESENT'
        ).length,
      };
    };

    // What each doctor earned, and who owes whom — the same sum the server does.
    if (seg[1] === 'earnings' && method === 'get') {
      const to = params?.to ? new Date(params.to) : new Date();
      to.setHours(23, 59, 59, 999);
      const from = params?.from
        ? new Date(params.from)
        : new Date(to.getFullYear(), to.getMonth(), 1);
      from.setHours(0, 0, 0, 0);

      return {
        from: from.toISOString(),
        to: to.toISOString(),
        doctors: db.doctors.map((doctor) => ({
          doctor: withStats(doctor),
          ...computeDoctorEarnings(
            doctor as any,
            db.visits as any,
            db.payments as any,
            db.expenses
              .filter((e) => e.category === 'SALARY' || e.category === 'COMMISSION')
              .map((e) => ({ amount: e.amount, date: e.date, doctorId: e.doctorId })),
            { from, to }
          ),
        })),
      };
    }

    // Posts a month's salaries to expenses, refusing to pay the same month twice.
    if (seg[1] === 'post-salaries' && method === 'post') {
      const period = body.period || salaryPeriod(new Date());
      const [year, month] = period.split('-').map(Number);
      const date = new Date(year, month, 0, 12);
      const tag = salaryTag(period);
      const alreadyPosted = new Set(
        db.expenses.filter((e) => (e.notes || '').includes(tag)).map((e) => e.doctorId)
      );

      const salaried = db.doctors.filter(
        (d) => d.active && d.employmentType === 'SALARIED' && (d.monthlySalary || 0) > 0
      );
      const created = salaried
        .filter((d) => !alreadyPosted.has(d.id))
        .map((d) => {
          const expense = {
            id: newId('exp_'),
            category: 'SALARY',
            title: `Salary — ${d.name}`,
            amount: d.monthlySalary!,
            date: date.toISOString(),
            paidTo: d.name,
            notes: tag,
            doctorId: d.id,
          };
          db.expenses.push(expense);
          return expense;
        });
      persist();
      return {
        period,
        posted: created.length,
        skipped: salaried.length - created.length,
        total: created.reduce((sum, e) => sum + e.amount, 0),
        expenses: created,
      };
    }

    if (seg.length === 1 && method === 'get') {
      const includeInactive = String(params?.includeInactive) === 'true';
      return db.doctors
        .filter((d) => includeInactive || d.active)
        .slice()
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
        .map(withStats);
    }
    if (seg.length === 1 && method === 'post') {
      const doctor = {
        id: newId('doc_'),
        name: body.name,
        specialization: body.specialization || null,
        qualification: body.qualification || null,
        phone: body.phone || null,
        email: body.email || null,
        consultationFee: body.consultationFee ?? null,
        departments: body.departments || [],
        employmentType: body.employmentType || 'SALARIED',
        monthlySalary: body.monthlySalary ?? null,
        commissionPercent: body.commissionPercent ?? null,
        joinedDate: body.joinedDate ? new Date(body.joinedDate).toISOString() : null,
        active: body.active ?? true,
        notes: body.notes || null,
        credentials: body.credentials || null,
        onLetterhead: body.onLetterhead ?? false,
      };
      db.doctors.push(doctor);
      persist();
      return doctor;
    }
    if (seg.length === 2 && method === 'get') {
      const d = db.doctors.find((x) => x.id === seg[1]);
      if (!d) throw { status: 404, error: 'Doctor not found' };
      return {
        ...withStats(d),
        visits: db.visits
          .filter((v) => v.doctorId === d.id)
          .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
          .slice(0, 50)
          .map((v) => ({ ...v, patient: patientBrief(v.patientId) })),
      };
    }
    if (seg.length === 2 && method === 'put') {
      const d = db.doctors.find((x) => x.id === seg[1])!;
      Object.assign(d, body, {
        joinedDate: body.joinedDate ? new Date(body.joinedDate).toISOString() : d.joinedDate,
      });
      persist();
      return d;
    }
    if (seg.length === 2 && method === 'delete') {
      // Keep doctors who have treated patients, so past sessions still show who did the work.
      if (db.visits.some((v) => v.doctorId === seg[1])) {
        const d = db.doctors.find((x) => x.id === seg[1])!;
        d.active = false;
        persist();
        return { deactivated: true, doctor: d };
      }
      db.doctors = db.doctors.filter((x) => x.id !== seg[1]);
      persist();
      return null;
    }
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
            (p.email || '').toLowerCase().includes(q) ||
            (p.attendantName || '').toLowerCase().includes(q)
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
        attendantName: body.attendantName || null,
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
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((d) => ({ ...withAttachments(d), doctor: doctorBrief(d.doctorId || null) })),
        packages: db.packages
          .filter((k) => k.patientId === patientId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((k) => ({
            ...k,
            installments: db.installments
              .filter((i) => i.packageId === k.id)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map((i) => ({ ...i, status: installmentStatus(i) })),
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
          .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
          .map((v) => ({ ...v, doctor: doctorBrief(v.doctorId) })),
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
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(withAttachments);
    }
    if (seg.length === 2 && method === 'get') {
      const d = db.diagnoses.find((x) => x.id === seg[1]);
      if (!d) throw { status: 404, error: 'Assessment not found' };
      return withAttachments(d);
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
        doctorId: body.doctorId || null,
        bodyRegion: body.bodyRegion || null,
        side: body.side || null,
        painScore: body.painScore ?? null,
        history: body.history || null,
        evaluation: body.evaluation || null,
        instructions: body.instructions || null,
        referredTo: body.referredTo || null,
        labFindings: body.labFindings || null,
        medications: body.medications || null,
        checkedDiagnoses: body.checkedDiagnoses || [],
        exercises: body.exercises || [],
        modalities: body.modalities || [],
        exerciseNotes: body.exerciseNotes || {},
      };
      db.diagnoses.push(d);
      persist();
      return withAttachments(d);
    }
    if (seg.length === 2 && method === 'put') {
      const d = db.diagnoses.find((x) => x.id === seg[1])!;
      Object.assign(d, body, body.date ? { date: new Date(body.date).toISOString() } : {});
      persist();
      return withAttachments(d);
    }
    if (seg.length === 2 && method === 'delete') {
      db.diagnoses = db.diagnoses.filter((x) => x.id !== seg[1]);
      // The reports attached to an assessment go with it, as they do on the server.
      db.attachments = db.attachments.filter((a) => a.diagnosisId !== seg[1]);
      persist();
      return null;
    }
  }

  // ---- attachments (reports and scans) ----
  if (seg[0] === 'attachments') {
    if (seg.length === 1 && method === 'get') {
      return db.attachments
        .filter((a) => !params?.patientId || a.patientId === params.patientId)
        .filter((a) => !params?.diagnosisId || a.diagnosisId === params.diagnosisId);
    }
    if (seg.length === 1 && method === 'post') {
      const attachment = {
        id: newId('att_'),
        patientId: body.patientId,
        diagnosisId: body.diagnosisId || null,
        filename: body.filename,
        mimeType: body.mimeType,
        size: body.size,
        label: body.label || null,
        uploadedAt: new Date().toISOString(),
        dataUrl: body.dataUrl,
      };
      db.attachments.push(attachment);
      persist();
      return attachment;
    }
    if (seg.length === 2 && method === 'delete') {
      db.attachments = db.attachments.filter((a) => a.id !== seg[1]);
      persist();
      return null;
    }
  }

  // ---- packages & installments ----
  if (seg[0] === 'packages') {
    if (seg[1] === 'installments' && seg.length === 3) {
      const inst = db.installments.find((i) => i.id === seg[2]);
      if (method === 'put' && inst) {
        const pkg = db.packages.find((k) => k.id === inst.packageId);
        Object.assign(inst, body);
        if (body.status === 'PAID' && !inst.paymentId && pkg) {
          const payment = {
            id: newId('pay_'),
            patientId: pkg.patientId,
            packageId: pkg.id,
            visitId: null,
            amount: inst.amount,
            type: 'INSTALLMENT',
            method: 'CASH',
            date: new Date().toISOString(),
            notes: `Installment for ${pkg.title}`,
          };
          db.payments.push(payment);
          inst.paymentId = payment.id;
          inst.paidDate = payment.date;
        }
        if (body.status && body.status !== 'PAID' && inst.paymentId) {
          db.payments = db.payments.filter((y) => y.id !== inst.paymentId);
          inst.paymentId = null;
          inst.paidDate = null;
        }
        // A paid installment whose amount is edited moves its payment with it.
        if (inst.paymentId && body.amount !== undefined) {
          const linked = db.payments.find((y) => y.id === inst.paymentId);
          if (linked) linked.amount = body.amount;
        }
        persist();
        return inst;
      }
      if (method === 'delete' && inst) {
        db.installments = db.installments.filter((i) => i.id !== inst.id);
        if (inst.paymentId) db.payments = db.payments.filter((y) => y.id !== inst.paymentId);
        persist();
        return null;
      }
    }
    if (seg.length === 3 && seg[2] === 'extend' && method === 'post') {
      const pkg = db.packages.find((k) => k.id === seg[1])!;
      const fee = body.feePerSession ?? pkg.feePerSession;
      const start = new Date(body.startDate);
      const freq = Math.max(1, body.frequencyDays || 2);
      // Numbered from the sessions that still hold a place — a moved session must not push
      // the next one up a number.
      const firstNumber = nextSessionNumber(db.visits.filter((v) => v.packageId === pkg.id));

      for (let i = 0; i < body.extraSessions; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * freq);
        db.visits.push({
          id: newId('vis_'),
          patientId: pkg.patientId,
          packageId: pkg.id,
          diagnosisId: pkg.diagnosisId,
          doctorId: null,
          sessionNumber: firstNumber + i,
          scheduledDate: d.toISOString(),
          completedDate: null,
          type: 'SESSION',
          fee,
          feeCollected: false,
          attendance: 'SCHEDULED',
          carriedForward: false,
          carriedFromId: null,
          remarks: null,
          treatmentNotes: null,
        });
      }
      if (body.chargeable !== false) {
        pkg.totalSessions += body.extraSessions;
        pkg.totalFee += body.extraSessions * fee;
      }
      pkg.status = 'ACTIVE';
      persist();
      return { package: pkg, added: body.extraSessions };
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
        paymentId: null,
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
      const startDate = body.startDate ? new Date(body.startDate) : new Date();
      const cycle = body.billingCycle || 'ONE_TIME';
      // A weekly or monthly package is turned into the ordinary shape here, the same way
      // the server does it, so the demo and the real system cannot drift apart.
      const cyclePlan = isRecurring(cycle)
        ? planCycles({
            cycle,
            sessionsPerCycle: body.sessionsPerCycle || 1,
            cycleFee: body.cycleFee || 0,
            cycles: body.cycles || 1,
            startDate,
          })
        : null;
      const totalSessions = cyclePlan ? cyclePlan.totalSessions : body.totalSessions;
      const feePerSession = cyclePlan
        ? totalSessions > 0
          ? cyclePlan.totalFee / totalSessions
          : 0
        : body.feePerSession;
      const totalFee = cyclePlan ? cyclePlan.totalFee : totalSessions * feePerSession;
      const pkg = {
        id: newId('pkg_'),
        patientId: body.patientId,
        diagnosisId: body.diagnosisId || null,
        title: body.title,
        totalSessions,
        feePerSession,
        totalFee,
        billingCycle: cycle,
        sessionsPerCycle: cyclePlan ? body.sessionsPerCycle : null,
        cycleFee: cyclePlan ? body.cycleFee : null,
        cycles: cyclePlan ? body.cycles : null,
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
            paymentId: null,
          });
        }
      } else if (cyclePlan && !(count > 0 && count !== cyclePlan.installments.length)) {
        // One payment per cycle: the row of due dates the reminders run off.
        let remaining = advance;
        cyclePlan.installments.forEach(({ amount, dueDate }) => {
          const covered = Math.min(remaining, amount);
          remaining -= covered;
          if (amount - covered <= 0) return;
          db.installments.push({
            id: newId('ins_'),
            packageId: pkg.id,
            amount: amount - covered,
            dueDate: dueDate.toISOString(),
            paidDate: null,
            status: 'PENDING',
            notes: null,
            paymentId: null,
          });
        });
      } else if (cyclePlan && count > 0 && totalFee - advance > 0) {
        // The clinic asked for its own number of installments instead of one per cycle.
        splitInstallments(totalFee - advance, count).forEach((amount, i) => {
          db.installments.push({
            id: newId('ins_'),
            packageId: pkg.id,
            amount,
            dueDate: addCycles(startDate, cycle, i + 1).toISOString(),
            paidDate: null,
            status: 'PENDING',
            notes: null,
            paymentId: null,
          });
        });
      } else if (count > 0 && totalFee - advance > 0) {
        splitInstallments(totalFee - advance, count).forEach((amount, i) => {
          const due = new Date(startDate);
          due.setMonth(due.getMonth() + i + 1);
          db.installments.push({
            id: newId('ins_'),
            packageId: pkg.id,
            amount,
            dueDate: due.toISOString(),
            paidDate: null,
            status: 'PENDING',
            notes: null,
            paymentId: null,
          });
        });
      }

      if (body.generateSchedule) {
        const freq =
          body.scheduleFrequencyDays ??
          (cyclePlan ? frequencyForCycle(cycle, body.sessionsPerCycle || 1) : 2);
        for (let s = 0; s < totalSessions; s++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + s * freq);
          db.visits.push({
            id: newId('vis_'),
            patientId: body.patientId,
            packageId: pkg.id,
            diagnosisId: body.diagnosisId || null,
            doctorId: body.doctorId || null,
            sessionNumber: s + 1,
            scheduledDate: d.toISOString(),
            completedDate: null,
            type: 'SESSION',
            fee: feePerSession,
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
            (!params?.doctorId || v.doctorId === params.doctorId) &&
            inRange(v.scheduledDate, params?.from, params?.to)
        )
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
        .map((v) => ({
          ...v,
          patient: patientBrief(v.patientId),
          doctor: doctorBrief(v.doctorId),
          package: v.packageId
            ? { title: db.packages.find((k) => k.id === v.packageId)?.title || '' }
            : null,
        }));
    }
    if (seg.length === 1 && method === 'post') {
      const count = Math.max(1, body.count || 1);
      const frequencyDays = Math.max(1, body.frequencyDays || 2);
      const start = new Date(body.scheduledDate);

      // Continue the package's existing numbering rather than restarting at 1, skipping rows
      // that no longer hold a place (moved or cancelled).
      let nextNumber: number | null = body.sessionNumber ?? null;
      if (nextNumber == null && body.packageId) {
        nextNumber = nextSessionNumber(db.visits.filter((v) => v.packageId === body.packageId));
      }

      const created = Array.from({ length: count }).map((_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i * frequencyDays);
        const v = {
          id: newId('vis_'),
          patientId: body.patientId,
          packageId: body.packageId || null,
          diagnosisId: body.diagnosisId || null,
          doctorId: body.doctorId || null,
          sessionNumber: nextNumber == null ? null : nextNumber + i,
          scheduledDate: d.toISOString(),
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
        return v;
      });
      persist();
      return { count: created.length, visits: created };
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
      // The same guards as the API: a session that happened or has already been moved
      // cannot be moved again.
      if (!canCarryForward(source)) {
        throw { status: 409, error: carryForwardBlockedReason(source) };
      }
      const target = new Date(body.newDate);
      if (target.toISOString().slice(0, 10) === source.scheduledDate.slice(0, 10)) {
        throw {
          status: 400,
          error: 'That is the day it is already booked for. Pick a different date to move it to.',
        };
      }
      source.attendance = 'CARRIED_FORWARD';
      source.carriedForward = true;
      const nv = {
        ...source,
        id: newId('vis_'),
        scheduledDate: target.toISOString(),
        completedDate: null,
        attendance: 'SCHEDULED',
        carriedForward: false,
        carriedFromId: source.id,
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
      if (db.payments.some((y) => y.visitId === seg[1])) {
        throw {
          status: 409,
          error:
            'This session has a payment recorded against it. Cancel the session instead, or delete the payment first.',
        };
      }
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
        discount: body.discount || 0,
        type: body.type,
        method: body.method || 'CASH',
        date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
        notes: body.notes || null,
        collectedByDoctorId: body.collectedByDoctorId || null,
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
        doctorId: body.doctorId || null,
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
    if (seg[1] === 'dashboard') {
      const now = new Date();
      const som = new Date(now.getFullYear(), now.getMonth(), 1);
      const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const sod = startOfToday();
      const eod = new Date(sod.getTime() + 86399000);

      const monthPayments = db.payments.filter(
        (p) => new Date(p.date) >= som && new Date(p.date) <= eom
      );
      const monthExpenses = db.expenses.filter(
        (e) => new Date(e.date) >= som && new Date(e.date) <= eom
      );
      const monthRevenue = monthPayments.reduce((s, p) => s + netAmount(p), 0);
      const monthExpenseTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);

      const accounts = computeAccounts();
      const outstandingDues = accounts.reduce((s, a) => s + a.due, 0);
      const patientCredits = accounts.reduce((s, a) => s + a.credit, 0);

      return {
        totalPatients: db.patients.length,
        activePackages: db.packages.filter((k) => k.status === 'ACTIVE').length,
        todaysVisits: db.visits
          .filter((v) => new Date(v.scheduledDate) >= sod && new Date(v.scheduledDate) <= eod)
          .map((v) => ({
            ...v,
            patient: patientBrief(v.patientId),
            doctor: doctorBrief(v.doctorId),
          })),
        overduePendingSessions: db.visits.filter(
          (v) => v.attendance === 'SCHEDULED' && new Date(v.scheduledDate) < sod
        ).length,
        monthRevenue,
        monthExpenses: monthExpenseTotal,
        monthProfit: monthRevenue - monthExpenseTotal,
        outstandingDues,
        patientCredits,
        duePayments: dueInstallments(7).slice(0, 8),
      };
    }

    if (seg[1] === 'due-payments' && method === 'get') {
      return dueInstallments(Math.max(0, Math.min(90, Number(params?.days) || 7)));
    }

    if (seg[1] === 'revenue') {
      const { from, to } = resolveRange(params);
      const bucket = bucketFor(from, to);
      const bKeys = bucketKeys(from, to, bucket);
      const by: Record<string, Record<string, number>> = {};
      for (const k of bKeys)
        by[k] = {
          CHECKUP_FEE: 0,
          ADVANCE: 0,
          SESSION_FEE: 0,
          INSTALLMENT: 0,
          VISIT_FEE: 0,
          REFUND: 0,
        };
      for (const p of db.payments) {
        const d = new Date(p.date);
        if (d < from || d > to) continue;
        const k = bucketKey(d, bucket);
        if (!by[k] || by[k][p.type] === undefined) continue;
        by[k][p.type] += netAmount(p);
      }
      return bKeys.map((k) => ({
        month: bucketLabel(k, bucket),
        total: Object.values(by[k]).reduce((a, b) => a + b, 0),
        ...by[k],
      }));
    }

    if (seg[1] === 'expenses-summary') {
      const { from, to } = resolveRange(params);
      const bucket = bucketFor(from, to);
      const bKeys = bucketKeys(from, to, bucket);
      const by: Record<string, number> = {};
      for (const k of bKeys) by[k] = 0;
      const byCategory: Record<string, number> = {};
      for (const e of db.expenses) {
        const d = new Date(e.date);
        if (d < from || d > to) continue;
        const k = bucketKey(d, bucket);
        if (by[k] !== undefined) by[k] += e.amount;
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      }
      return {
        series: bKeys.map((k) => ({ month: bucketLabel(k, bucket), total: by[k] })),
        byCategory: Object.entries(byCategory).map(([category, total]) => ({ category, total })),
      };
    }

    if (seg[1] === 'profit-loss') {
      const { from, to } = resolveRange(params);
      const bucket = bucketFor(from, to);
      const bKeys = bucketKeys(from, to, bucket);
      const rev: Record<string, number> = {};
      const exp: Record<string, number> = {};
      for (const k of bKeys) {
        rev[k] = 0;
        exp[k] = 0;
      }
      for (const p of db.payments) {
        const d = new Date(p.date);
        if (d < from || d > to) continue;
        const k = bucketKey(d, bucket);
        if (rev[k] !== undefined) rev[k] += netAmount(p);
      }
      for (const e of db.expenses) {
        const d = new Date(e.date);
        if (d < from || d > to) continue;
        const k = bucketKey(d, bucket);
        if (exp[k] !== undefined) exp[k] += e.amount;
      }
      const rows = bKeys.map((k) => ({
        month: bucketLabel(k, bucket),
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
      return computeAccounts()
        .filter((a) => a.due > 0)
        .sort((a, b) => b.due - a.due);
    }

    if (seg[1] === 'credits') {
      return computeAccounts()
        .filter((a) => a.credit > 0)
        .sort((a, b) => b.credit - a.credit);
    }

    // Mirrors /reports/analytics on the server: caseload mix, each doctor's diary, new
    // registrations — the operational picture rather than the money one.
    if (seg[1] === 'analytics') {
      const { from, to } = resolveRange(params);
      const bucket = bucketFor(from, to);
      const bKeys = bucketKeys(from, to, bucket);

      const diagnosisCounts = new Map<string, number>();
      for (const d of db.diagnoses) {
        const dDate = new Date(d.date);
        if (dDate < from || dDate > to) continue;
        const title = (d.title || '').trim();
        if (!title) continue;
        diagnosisCounts.set(title, (diagnosisCounts.get(title) || 0) + 1);
      }
      const topDiagnoses = [...diagnosisCounts.entries()]
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const byDoctor = new Map<string, { sessions: number; billed: number; absent: number }>();
      for (const v of db.visits) {
        if (!v.doctorId) continue;
        const vDate = new Date(v.scheduledDate);
        if (vDate < from || vDate > to) continue;
        if (v.attendance !== 'PRESENT' && v.attendance !== 'ABSENT') continue;
        const row = byDoctor.get(v.doctorId) || { sessions: 0, billed: 0, absent: 0 };
        if (v.attendance === 'PRESENT') {
          row.sessions += 1;
          row.billed += v.fee;
        } else {
          row.absent += 1;
        }
        byDoctor.set(v.doctorId, row);
      }
      const doctorActivity = db.doctors
        .map((d) => {
          const row = byDoctor.get(d.id) || { sessions: 0, billed: 0, absent: 0 };
          const booked = row.sessions + row.absent;
          return {
            doctorId: d.id,
            name: d.name,
            sessions: row.sessions,
            billed: row.billed,
            attendanceRate: booked ? Math.round((row.sessions / booked) * 100) : null,
          };
        })
        .filter((d) => d.sessions > 0 || d.billed > 0)
        .sort((a, b) => b.billed - a.billed);

      const patientsByBucket: Record<string, number> = {};
      for (const key of bKeys) patientsByBucket[key] = 0;
      for (const p of db.patients) {
        const pDate = new Date(p.createdAt);
        if (pDate < from || pDate > to) continue;
        const key = bucketKey(pDate, bucket);
        if (patientsByBucket[key] !== undefined) patientsByBucket[key] += 1;
      }

      return {
        topDiagnoses,
        doctorActivity,
        newPatients: bKeys.map((key) => ({
          month: bucketLabel(key, bucket),
          count: patientsByBucket[key],
        })),
      };
    }

    // Mirrors /reports/reactivation: patients who have gone quiet and have nothing booked.
    if (seg[1] === 'reactivation') {
      const days = Math.max(1, Math.min(365, Number(params?.days) || 45));
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);

      return db.patients
        .map((p) => {
          const patientVisits = db.visits.filter((v) => v.patientId === p.id);
          const presentDates = patientVisits
            .filter((v) => v.attendance === 'PRESENT')
            .map((v) => new Date(v.scheduledDate).getTime());
          if (!presentDates.length) return null;
          const lastVisit = new Date(Math.max(...presentDates));
          const hasUpcoming = patientVisits.some(
            (v) => v.attendance === 'SCHEDULED' && new Date(v.scheduledDate).getTime() > now.getTime()
          );
          if (hasUpcoming || lastVisit > cutoff) return null;
          const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / 86400000);
          return {
            patient: { id: p.id, name: p.name, phone: p.phone },
            lastVisit: lastVisit.toISOString(),
            daysSince,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => a.daysSince - b.daysSince)
        .slice(0, 30);
    }
  }

  throw { status: 404, error: `Demo API has no handler for ${method.toUpperCase()} ${path}` };
}

/**
 * An upload arrives as FormData carrying a real File. There is no server to send it to, so the
 * bytes are read here and kept with the record; the browser store is small, hence the cap.
 */
const DEMO_MAX_UPLOAD = 1.5 * 1024 * 1024;

async function formDataToBody(form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File)) throw { status: 400, error: 'No file was uploaded.' };
  if (file.size > DEMO_MAX_UPLOAD) {
    throw {
      status: 413,
      error: `In the demo a file has to be under ${DEMO_MAX_UPLOAD / 1024 / 1024} MB, because it is kept in the browser. The installed system takes files up to 10 MB.`,
    };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject({ status: 400, error: 'That file could not be read.' });
    reader.readAsDataURL(file);
  });

  return {
    patientId: String(form.get('patientId') || ''),
    diagnosisId: String(form.get('diagnosisId') || '') || null,
    label: String(form.get('label') || '') || null,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    dataUrl,
  };
}

export const demoAdapter: AxiosAdapter = async (config: AxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase();
  // Some callers put the query inline in the url, others pass config.params — support both.
  const [rawPath, rawQuery] = (config.url || '').replace(/^\/api/, '').split('?');
  const params = { ...Object.fromEntries(new URLSearchParams(rawQuery || '')), ...config.params };
  const path = rawPath;

  // a touch of latency so loading states behave like the real thing
  await new Promise((r) => setTimeout(r, 60));

  try {
    const body =
      config.data instanceof FormData
        ? await formDataToBody(config.data)
        : typeof config.data === 'string'
          ? JSON.parse(config.data || '{}')
          : config.data || {};
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
