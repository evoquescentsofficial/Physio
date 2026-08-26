/**
 * Sample clinic data for the browser-only demo build, so charts and lists have
 * something realistic in them the moment the demo is opened.
 *
 * Uses a fixed-seed pseudo-random generator so every visitor sees the same numbers.
 */
import { DemoDb } from './demoTypes';

const id = (() => {
  let n = 0;
  return (prefix: string) => `${prefix}${(++n).toString().padStart(4, '0')}`;
})();

/** Deterministic PRNG (mulberry32) — same demo every time the page is opened. */
function makeRandom(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function atDay(daysBack: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function monthsAgo(n: number, day = 5) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  d.setHours(10, 0, 0, 0);
  // Picking a day-of-month can overshoot today in the current month — never date sample
  // records in the future, or the app shows registrations that haven't happened yet.
  const now = new Date();
  if (d > now) d.setMonth(d.getMonth() - 1);
  return d;
}

const PEOPLE = [
  ['Ahmed Raza', '0301-2345678', 'Male', 'Bank officer'],
  ['Fatima Khan', '0333-9876543', 'Female', 'Teacher'],
  ['Bilal Hussain', '0321-5551234', 'Male', 'Driver'],
  ['Ayesha Siddiqui', '0345-7778888', 'Female', 'Housewife'],
  ['Usman Tariq', '0300-1112223', 'Male', 'Shopkeeper'],
  ['Sana Malik', '0311-4445556', 'Female', 'Nurse'],
  ['Imran Aslam', '0302-6667778', 'Male', 'Factory worker'],
  ['Hina Javed', '0334-2223334', 'Female', 'Student'],
  ['Kamran Sheikh', '0322-8889990', 'Male', 'Businessman'],
  ['Nadia Iqbal', '0346-1234567', 'Female', 'Seamstress'],
  ['Rizwan Ahmed', '0303-7654321', 'Male', 'Security guard'],
  ['Maryam Butt', '0335-3456789', 'Female', 'Accountant'],
];

const CONDITIONS: [string, string][] = [
  ['Lower back pain (L4-L5 disc bulge)', 'Chronic pain radiating to left leg, onset 3 months ago.'],
  ['Frozen shoulder (right)', 'Restricted range of motion, worse at night.'],
  ['Knee osteoarthritis (both)', 'Grade 2 changes, difficulty climbing stairs.'],
  ['Cervical spondylosis', 'Neck stiffness with occasional headaches.'],
  ['Post-fracture ankle rehab', 'Six weeks post cast removal, weak dorsiflexion.'],
  ['Sciatica (left)', 'Shooting pain from hip to calf on prolonged sitting.'],
  ['Tennis elbow (right)', 'Pain on gripping, tender over lateral epicondyle.'],
  ['Post-stroke gait training', 'Mild left-sided weakness, walking with support.'],
  ['Plantar fasciitis', 'Heel pain worst on first steps in the morning.'],
  ['Rotator cuff tendinitis', 'Painful arc on overhead movement.'],
];

export function buildDemoDb(): DemoDb {
  const random = makeRandom(20260811);

  const db: DemoDb = {
    settings: {
      id: 'clinic',
      clinicName: 'Physio Fitness Clinic',
      phone: '0300-1234567',
      address: 'Main Boulevard, Lahore',
      checkupFee: 1000,
      defaultSessionFee: 1500,
    },
    patients: [],
    doctors: [],
    diagnoses: [],
    packages: [],
    installments: [],
    visits: [],
    payments: [],
    expenses: [],
  };

  const doctorSeed: [string, string, string, number | null][] = [
    ['Dr. Imran Shah', 'Orthopaedic physiotherapy', 'DPT, MSPT', 1500],
    ['Dr. Sana Aslam', 'Sports injury rehabilitation', 'DPT', 1200],
    ['Dr. Farhan Qureshi', 'Neurological physiotherapy', 'DPT, PhD', null],
  ];
  doctorSeed.forEach(([name, specialization, qualification, fee], i) => {
    db.doctors.push({
      id: id('doc_'),
      name,
      specialization,
      qualification,
      phone: `0300-11122${i}${i}`,
      email: null,
      consultationFee: fee,
      joinedDate: monthsAgo(10 + i * 4, 1).toISOString(),
      active: true,
      notes: null,
    });
  });

  PEOPLE.forEach((person, idx) => {
    const [name, phone, gender, occupation] = person;
    const patientId = id('pat_');
    // registrations spread over the last six months, newest patients last
    const monthOffset = Math.max(0, 5 - Math.floor(idx / 2));
    const registered = monthsAgo(monthOffset, 3 + ((idx * 5) % 22));

    db.patients.push({
      id: patientId,
      name,
      phone,
      email: null,
      address: 'Lahore',
      dob: null,
      gender,
      occupation,
      referredBy: idx % 3 === 0 ? 'Dr. Saleem' : null,
      bloodGroup: null,
      emergencyContact: null,
      notes: null,
      createdAt: registered.toISOString(),
      updatedAt: registered.toISOString(),
    });

    // every patient pays the checkup fee on their first visit
    db.payments.push({
      id: id('pay_'),
      patientId,
      packageId: null,
      visitId: null,
      amount: 1000,
      type: 'CHECKUP_FEE',
      method: 'CASH',
      date: registered.toISOString(),
      notes: 'First visit checkup fee',
    });

    const condition = CONDITIONS[idx % CONDITIONS.length];
    const diagnosisId = id('dia_');
    db.diagnoses.push({
      id: diagnosisId,
      patientId,
      date: registered.toISOString(),
      title: condition[0],
      details: condition[1],
      treatmentPlan: 'Manual therapy, TENS, supervised strengthening exercises.',
      remarks: 'Advised to avoid heavy lifting and continue home exercises.',
      doctorName: db.doctors[idx % db.doctors.length].name,
      doctorId: db.doctors[idx % db.doctors.length].id,
      bodyRegion: ['Lower back', 'Shoulder', 'Knee', 'Neck', 'Ankle & foot'][idx % 5],
      side: ['Left', 'Right', 'Both', 'Not applicable'][idx % 4],
      painScore: 4 + (idx % 5),
    });

    // the two newest patients are checkup-only so far — no package yet
    if (idx >= PEOPLE.length - 2) return;

    const totalSessions = [8, 10, 12][idx % 3];
    const feePerSession = 1500;
    const totalFee = totalSessions * feePerSession;
    const advance = Math.round((totalFee * (0.3 + random() * 0.2)) / 500) * 500;
    const packageId = id('pkg_');

    db.packages.push({
      id: packageId,
      patientId,
      diagnosisId,
      title: `${condition[0].split('(')[0].trim()} — ${totalSessions} sessions`,
      totalSessions,
      feePerSession,
      totalFee,
      startDate: registered.toISOString(),
      status: monthOffset >= 4 ? 'COMPLETED' : 'ACTIVE',
      notes: null,
      createdAt: registered.toISOString(),
    });

    db.payments.push({
      id: id('pay_'),
      patientId,
      packageId,
      visitId: null,
      amount: advance,
      type: 'ADVANCE',
      method: idx % 3 === 0 ? 'BANK_TRANSFER' : 'CASH',
      date: registered.toISOString(),
      notes: 'Advance at package start',
    });

    // balance split into 3 monthly installments; the ones already due are paid
    const balance = totalFee - advance;
    const per = Math.floor(balance / 3);
    for (let i = 0; i < 3; i++) {
      const due = new Date(registered);
      due.setMonth(due.getMonth() + i + 1);
      const amount = i === 2 ? balance - per * 2 : per;
      const isPaid = due < new Date();
      db.installments.push({
        id: id('ins_'),
        packageId,
        amount,
        dueDate: due.toISOString(),
        paidDate: isPaid ? due.toISOString() : null,
        status: isPaid ? 'PAID' : 'PENDING',
        notes: null,
        paymentId: null,
      });
      if (isPaid) {
        db.payments.push({
          id: id('pay_'),
          patientId,
          packageId,
          visitId: null,
          amount,
          type: 'INSTALLMENT',
          method: 'CASH',
          date: due.toISOString(),
          notes: 'Monthly installment',
        });
      }
    }

    // session schedule every 2 days from the start date
    for (let s = 0; s < totalSessions; s++) {
      const d = new Date(registered);
      d.setDate(d.getDate() + s * 2);
      const inPast = d < new Date();
      let attendance = 'SCHEDULED';
      if (inPast) attendance = random() < 0.12 ? 'ABSENT' : 'PRESENT';
      db.visits.push({
        id: id('vis_'),
        patientId,
        packageId,
        diagnosisId,
        doctorId: db.doctors[idx % db.doctors.length].id,
        sessionNumber: s + 1,
        scheduledDate: d.toISOString(),
        completedDate: attendance === 'PRESENT' ? d.toISOString() : null,
        type: 'SESSION',
        fee: feePerSession,
        feeCollected: attendance === 'PRESENT',
        attendance,
        carriedForward: false,
        carriedFromId: null,
        remarks: null,
        treatmentNotes: attendance === 'PRESENT' ? 'Responded well, pain reduced.' : null,
      });
    }
  });

  // a few sessions scheduled for today so the dashboard's list is not empty
  const todayHours = [9, 11, 16];
  db.patients.slice(0, 3).forEach((p, i) => {
    const t = new Date();
    t.setHours(todayHours[i], 0, 0, 0);
    db.visits.push({
      id: id('vis_'),
      patientId: p.id,
      packageId: null,
      diagnosisId: null,
      doctorId: db.doctors[i % db.doctors.length].id,
      sessionNumber: null,
      scheduledDate: t.toISOString(),
      completedDate: null,
      type: i === 0 ? 'FOLLOWUP' : 'SESSION',
      fee: 1500,
      feeCollected: false,
      attendance: 'SCHEDULED',
      carriedForward: false,
      carriedFromId: null,
      remarks: i === 0 ? 'Review progress' : null,
      treatmentNotes: null,
    });
  });

  // walk-in traffic: a handful of single paid sessions on each working day
  for (let daysBack = 1; daysBack <= 180; daysBack++) {
    const day = atDay(daysBack);
    if (day.getDay() === 0) continue; // closed Sundays
    const count = 4 + Math.floor(random() * 3); // 4–6 walk-ins
    for (let i = 0; i < count; i++) {
      db.payments.push({
        id: id('pay_'),
        patientId: db.patients[Math.floor(random() * db.patients.length)].id,
        packageId: null,
        visitId: null,
        amount: 1500,
        type: 'SESSION_FEE',
        method: random() < 0.75 ? 'CASH' : 'CARD',
        date: new Date(day.getTime() + i * 3600000).toISOString(),
        notes: 'Single session',
      });
    }
  }

  // Running costs, dated to the day each one is actually paid. Booking a whole month of
  // rent and salaries on the 2nd made every month look like a loss until the day's takings
  // caught up — the clinic appeared to be failing for the first three weeks of every month.
  const monthlyCosts: { category: string; title: string; amount: number; day: number }[] = [
    { category: 'RENT', title: 'Clinic rent', amount: 45000, day: 1 },
    { category: 'UTILITIES', title: 'Electricity, gas and internet', amount: 18000, day: 10 },
    { category: 'MAINTENANCE', title: 'Cleaning and supplies', amount: 9000, day: 15 },
    { category: 'SALARY', title: 'Therapist salary — Sana', amount: 60000, day: 28 },
    { category: 'SALARY', title: 'Receptionist salary — Hina', amount: 30000, day: 28 },
  ];

  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    for (const cost of monthlyCosts) {
      const date = new Date(now.getFullYear(), now.getMonth() - m, cost.day, 10, 0, 0, 0);
      // Salaries due at month end have not been paid yet, so they are not an expense yet.
      if (date > now) continue;
      db.expenses.push({
        id: id('exp_'),
        category: cost.category,
        title: cost.title,
        amount: cost.amount,
        date: date.toISOString(),
        paidTo: null,
        notes: null,
      });
    }
  }
  db.expenses.push({
    id: id('exp_'),
    category: 'EQUIPMENT',
    title: 'Ultrasound therapy machine',
    amount: 85000,
    date: monthsAgo(3, 12).toISOString(),
    paidTo: 'MedTech Supplies',
    notes: 'One-time purchase',
  });
  db.expenses.push({
    id: id('exp_'),
    category: 'MARKETING',
    title: 'Facebook ads and flyers',
    amount: 12000,
    date: monthsAgo(1, 8).toISOString(),
    paidTo: null,
    notes: null,
  });

  return db;
}
