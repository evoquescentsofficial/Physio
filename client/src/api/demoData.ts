/**
 * Sample clinic data for the browser-only demo build, so charts and lists have
 * something realistic in them the moment the demo is opened.
 *
 * Uses a fixed-seed pseudo-random generator so every visitor sees the same numbers.
 */
import { DemoDb } from './demoTypes';
import { DEFAULT_DEPARTMENTS } from '../../../shared/commission';
import { planCycles } from '../../../shared/packages';
import {
  DEFAULT_DIAGNOSIS_OPTIONS,
  DEFAULT_EXERCISE_OPTIONS,
  DEFAULT_FORM_TITLE,
  DEFAULT_MODALITY_OPTIONS,
} from '../../../shared/prescription';

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

// The attendant is optional, so the sample data leaves plenty of patients without one.
const ATTENDANTS: (string | null)[] = [
  'Raza Ahmed (son)',
  null,
  null,
  'Sadia Siddiqui (daughter)',
  null,
  'Asif Malik (husband)',
  null,
  'Javed Iqbal (father)',
  null,
  null,
  'Shahid Ahmed (brother)',
  null,
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

/**
 * What a filled-in prescription pad actually says, one per condition above. Without this the
 * demo prints an empty form, which shows nothing about how the record works.
 */
const ASSESSMENTS: {
  history: string;
  evaluation: string;
  diagnoses: string[];
  exercises: string[];
  modalities: string[];
  instructions: string;
  lab?: string;
  medications?: string;
  referredTo?: string;
}[] = [
  {
    history:
      'Gradual onset over 3 months, worse after long hours at a desk. No trauma. Pain radiates to the left leg on sitting.',
    evaluation:
      'Lumbar flexion restricted to 40°, SLR positive at 45° on the left, tenderness over L4-L5, no neurological deficit.',
    diagnoses: ['Low Back Pain', 'Sciatica'],
    exercises: ['Stretching', 'Spinal Stabilisation', 'Postural Alignment'],
    modalities: ['TENS', 'Hot Pack', 'Traction — Lumbar'],
    instructions:
      'Avoid lifting over 5 kg. Use a lumbar roll when sitting. Walk 20 minutes daily. Home exercises twice a day.',
    lab: 'MRI lumbar spine: L4-L5 disc bulge with mild left foraminal narrowing.',
    medications: 'Tab. Naproxen 250 mg twice daily after meals for 5 days.',
  },
  {
    history:
      'Right shoulder stiffness for 5 months, worst at night, unable to reach behind the back. Known diabetic.',
    evaluation:
      'Capsular pattern: abduction 80°, external rotation 15°. Painful arc absent. Strength preserved.',
    diagnoses: ['Frozen Shoulder'],
    exercises: ['Passive Movements', 'Mobilisation', 'Stretching'],
    modalities: ['Ultrasound', 'Hot Pack'],
    instructions:
      'Pendulum exercises 3 times daily. Wall climbing to tolerance. Keep blood sugar controlled — recovery is slower otherwise.',
  },
  {
    history: 'Both knees painful on stairs for 2 years, morning stiffness under 30 minutes.',
    evaluation: 'Crepitus both knees, quadriceps wasting, flexion 110° right and 115° left.',
    diagnoses: ['Knee Pain', 'Arthritis'],
    exercises: ['Active Therapy', 'Cardio Vascular Therapy', 'Stretching'],
    modalities: ['TENS', 'Hot Pack', 'EMS'],
    instructions: 'Quadriceps strengthening daily. Avoid squatting and stairs where possible. Weight reduction advised.',
    lab: 'X-ray both knees: Grade 2 changes, joint space narrowing medially.',
  },
  {
    history: 'Neck stiffness with headaches for 6 weeks, worse after screen work.',
    evaluation: 'Cervical rotation 50° bilaterally, tenderness over C5-C6 paraspinals, Spurling negative.',
    diagnoses: ['Cervical Pain'],
    exercises: ['Postural Alignment', 'Stretching', 'Mobilisation'],
    modalities: ['Traction — Cervical', 'Hot Pack', 'Ultrasound'],
    instructions: 'Screen at eye level. Chin tucks hourly. No pillow stacking at night.',
  },
  {
    history: 'Ankle fracture 6 weeks ago, cast removed last week. Walking with a limp.',
    evaluation: 'Dorsiflexion 5°, swelling around the lateral malleolus, single-leg stance not achieved.',
    diagnoses: [],
    exercises: ['Passive Movements', 'Active Therapy', 'Stretching'],
    modalities: ['Ultrasound', 'Cold Pack'],
    instructions: 'Elevate the ankle when resting. Full weight bearing as pain allows. Ice 10 minutes after exercises.',
    referredTo: 'Orthopaedic surgeon for 8-week review',
  },
  {
    history: 'Shooting pain from the left hip to the calf on prolonged sitting, 6 weeks.',
    evaluation: 'SLR positive at 40° left, slump test positive, ankle reflexes intact.',
    diagnoses: ['Sciatica', 'Low Back Pain'],
    exercises: ['Stretching', 'Spinal Stabilisation'],
    modalities: ['TENS', 'Traction — Lumbar', 'Hot Pack'],
    instructions: 'Stand and move every 30 minutes. Nerve glide exercises twice daily.',
  },
  {
    history: 'Right elbow pain on gripping for 2 months. Works as a mechanic.',
    evaluation: 'Tender over the lateral epicondyle, resisted wrist extension painful, grip strength reduced.',
    diagnoses: [],
    exercises: ['Stretching', 'Active Therapy'],
    modalities: ['Ultrasound', 'Taping', 'Cold Pack'],
    instructions: 'Counterforce brace at work. Eccentric wrist extensor exercises daily. Avoid heavy gripping for 3 weeks.',
  },
  {
    history: 'Stroke 4 months ago with left-sided weakness. Walking indoors with a stick.',
    evaluation: 'Left hip flexion grade 3, knee extension grade 3+, ankle dorsiflexion grade 2. Balance impaired.',
    diagnoses: ['Stroke'],
    exercises: ['Active Therapy', 'Postural Alignment', 'Cardio Vascular Therapy'],
    modalities: ['EMS'],
    instructions: 'Practise sit-to-stand 10 times, 3 times a day, with supervision. Continue the stick outdoors.',
    medications: 'Continuing as prescribed by the neurologist.',
    referredTo: 'Neurologist for 6-month review',
  },
  {
    history: 'Heel pain worst on the first steps in the morning, 3 months.',
    evaluation: 'Tender over the medial calcaneal tubercle, tight tendo-achilles, windlass test positive.',
    diagnoses: [],
    exercises: ['Stretching', 'Active Therapy'],
    modalities: ['Ultrasound', 'Cold Pack', 'Taping'],
    instructions: 'Calf and plantar fascia stretches before getting out of bed. Cushioned footwear indoors. Ice bottle roll at night.',
  },
  {
    history: 'Right shoulder pain on overhead movement for 2 months, no trauma.',
    evaluation: 'Painful arc 70-110°, empty can test positive, external rotation strength grade 4.',
    diagnoses: ['Frozen Shoulder'],
    exercises: ['Active Therapy', 'Mobilisation', 'Stretching'],
    modalities: ['Ultrasound', 'Hot Pack', 'Taping'],
    instructions: 'Avoid overhead work for 2 weeks. Rotator cuff strengthening with a band, daily.',
  },
];

export function buildDemoDb(): DemoDb {
  const random = makeRandom(20260811);

  const db: DemoDb = {
    settings: {
      id: 'clinic',
      clinicName: 'Physio Fitness Clinic',
      phone: '0301-8737071 / 0342-7076622',
      address: '299-B Block Shah Rukn-e-Alam Colony, Multan',
      checkupFee: 1000,
      defaultSessionFee: 1500,
      email: 'aj.physio32@gmail.com',
      website: 'www.fb.com/physiofitnesscentre',
      instagram: '@physio_fitness_centre',
      timings: '6pm to 9pm (Monday to Saturday) · Sunday closed',
      formTitle: DEFAULT_FORM_TITLE,
      diagnosisOptions: DEFAULT_DIAGNOSIS_OPTIONS,
      exerciseOptions: DEFAULT_EXERCISE_OPTIONS,
      modalityOptions: DEFAULT_MODALITY_OPTIONS,
      departmentOptions: DEFAULT_DEPARTMENTS,
    },
    patients: [],
    doctors: [],
    diagnoses: [],
    packages: [],
    installments: [],
    visits: [],
    payments: [],
    expenses: [],
    attachments: [],
    users: [
      {
        id: 'usr_admin',
        name: 'Clinic Admin',
        email: 'admin@physio.clinic',
        role: 'ADMIN',
        createdAt: new Date(2025, 0, 1).toISOString(),
      },
      {
        id: 'usr_senior',
        name: 'Dr. Imran Shah',
        email: 'doctor@physio.clinic',
        role: 'DOCTOR',
        createdAt: new Date(2025, 0, 1).toISOString(),
      },
      {
        id: 'usr_junior',
        name: 'Dr. Bilal (Trainee)',
        email: 'junior@physio.clinic',
        role: 'JUNIOR_DOCTOR',
        createdAt: new Date(2025, 6, 1).toISOString(),
      },
      {
        id: 'usr_reception',
        name: 'Front Desk',
        email: 'reception@physio.clinic',
        role: 'RECEPTIONIST',
        createdAt: new Date(2025, 0, 1).toISOString(),
      },
    ],
    auditLog: [],
    session: null,
  };

  // The last two columns are the credentials block printed on the prescription, and whether
  // this doctor appears on it at all.
  // name, specialization, qualification, consultation fee, credentials, departments,
  // how they are paid, salary, commission %
  const doctorSeed: [
    string,
    string,
    string,
    number | null,
    string | null,
    string[],
    'SALARIED' | 'COMMISSION',
    number | null,
    number | null,
  ][] = [
    [
      'Dr. Imran Shah',
      'Orthopaedic physiotherapy',
      'DPT, MSPT',
      1500,
      'DPT (MMDC / UHS)\nMS-OMPT (RIU)\nCertified in Dry Needling & Injection Therapy\nClinical Physiotherapist at Bakhtawar Amin Teaching Hospital',
      ['Physiotherapy', 'Orthopaedic rehabilitation'],
      'SALARIED',
      90000,
      null,
    ],
    [
      'Dr. Sana Aslam',
      'Sports injury rehabilitation',
      'DPT',
      1200,
      'DPT (MMDC / UHS)\nCertified in Dry Needling & Injection Therapy\nClinical Physiotherapist at Ibn-e-Sina Hospital',
      ['Sports injury rehabilitation', 'Physiotherapy'],
      'SALARIED',
      70000,
      null,
    ],
    [
      'Dr. Farhan Qureshi',
      'Neurological physiotherapy',
      'DPT, PhD',
      null,
      null,
      ['Neuro rehabilitation'],
      // Sits in the clinic on his own account and keeps 70% of what his sessions bill.
      'COMMISSION',
      null,
      70,
    ],
  ];
  doctorSeed.forEach(
    (
      [
        name,
        specialization,
        qualification,
        fee,
        credentials,
        departments,
        employmentType,
        monthlySalary,
        commissionPercent,
      ],
      i
    ) => {
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
      credentials,
      onLetterhead: !!credentials,
      departments,
      employmentType,
      monthlySalary,
      commissionPercent,
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
      // Ages spread across a real caseload, so the printed form has an age on it.
      dob: new Date(Date.UTC(1962 + idx * 2, (idx * 5) % 12, 4 + (idx % 24))).toISOString(),
      gender,
      occupation,
      referredBy: idx % 3 === 0 ? 'Dr. Saleem' : null,
      bloodGroup: null,
      // Some patients are brought in by family, others come on their own.
      attendantName: ATTENDANTS[idx % ATTENDANTS.length],
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
    const assessment = ASSESSMENTS[idx % ASSESSMENTS.length];
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
      history: assessment.history,
      evaluation: assessment.evaluation,
      instructions: assessment.instructions,
      referredTo: assessment.referredTo || null,
      labFindings: assessment.lab || null,
      medications: assessment.medications || null,
      checkedDiagnoses: assessment.diagnoses,
      exercises: assessment.exercises,
      modalities: assessment.modalities,
      // The clinic's very first patient shows what a junior doctor's write-up looks like
      // before anyone senior has reviewed it — everyone else's is already approved.
      reviewStatus: idx === 0 ? 'PENDING' : 'APPROVED',
      reviewedByName: idx === 0 ? null : db.doctors[idx % db.doctors.length].name,
      reviewedAt: idx === 0 ? null : registered.toISOString(),
    });

    // the two newest patients are checkup-only so far — no package yet
    if (idx >= PEOPLE.length - 2) return;

    // The two most recent patients who have a course are on a monthly plan instead of a
    // one-off package — the arrangement a clinic uses for long rehab, and what the payment
    // reminders run off. (The last two patients are checkup-only and return before this.)
    const monthly = idx === PEOPLE.length - 4 || idx === PEOPLE.length - 3;
    const cyclePlan = monthly
      ? planCycles({
          cycle: 'MONTHLY',
          sessionsPerCycle: 12,
          cycleFee: 12000,
          cycles: 3,
          startDate: registered,
        })
      : null;

    const totalSessions = cyclePlan ? cyclePlan.totalSessions : [8, 10, 12][idx % 3];
    const feePerSession = cyclePlan ? cyclePlan.totalFee / cyclePlan.totalSessions : 1500;
    const totalFee = cyclePlan ? cyclePlan.totalFee : totalSessions * feePerSession;
    const advance = cyclePlan
      ? 12000
      : Math.round((totalFee * (0.3 + random() * 0.2)) / 500) * 500;
    const packageId = id('pkg_');

    db.packages.push({
      id: packageId,
      patientId,
      diagnosisId,
      title: cyclePlan
        ? `${condition[0].split('(')[0].trim()} — monthly plan`
        : `${condition[0].split('(')[0].trim()} — ${totalSessions} sessions`,
      totalSessions,
      feePerSession,
      totalFee,
      billingCycle: cyclePlan ? 'MONTHLY' : 'ONE_TIME',
      sessionsPerCycle: cyclePlan ? 12 : null,
      cycleFee: cyclePlan ? 12000 : null,
      cycles: cyclePlan ? 3 : null,
      startDate: registered.toISOString(),
      status: monthOffset >= 4 ? 'COMPLETED' : 'ACTIVE',
      notes: null,
      createdAt: registered.toISOString(),
    });

    // A monthly plan bills once a month: the first is settled by the advance, the rest fall due.
    if (cyclePlan) {
      cyclePlan.installments.slice(1).forEach(({ amount, dueDate }) => {
        db.installments.push({
          id: id('ins_'),
          packageId,
          amount,
          dueDate: dueDate.toISOString(),
          paidDate: null,
          status: 'PENDING',
          notes: null,
          paymentId: null,
        });
      });
    }

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

    // A monthly plan already has its own row of due dates, one per cycle, created above.
    // Only a one-off package splits the balance into installments here.
    const balance = cyclePlan ? 0 : totalFee - advance;
    const per = Math.floor(balance / 3);
    for (let i = 0; i < (cyclePlan ? 0 : 3); i++) {
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
        doctorId: null,
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
    doctorId: null,
  });

  // The commission doctor: last month he took some fees at the chair, and was settled up
  // afterwards. This is what makes the settlement table on the Doctors page mean something.
  const commissionDoctor = db.doctors.find((d) => d.employmentType === 'COMMISSION');
  if (commissionDoctor) {
    const hisVisits = db.visits.filter(
      (v) => v.doctorId === commissionDoctor.id && v.attendance === 'PRESENT'
    );
    hisVisits.slice(0, 6).forEach((v, i) => {
      if (i % 2) return;
      db.payments.push({
        id: id('pay_'),
        patientId: v.patientId,
        packageId: v.packageId,
        visitId: v.id,
        amount: v.fee,
        type: 'SESSION_FEE',
        method: 'CASH',
        date: v.completedDate || v.scheduledDate,
        notes: 'Taken at the chair',
        collectedByDoctorId: commissionDoctor.id,
      });
    });

    db.expenses.push({
      id: id('exp_'),
      category: 'COMMISSION',
      title: `Commission — ${commissionDoctor.name}`,
      amount: 18000,
      date: monthsAgo(1, 28).toISOString(),
      paidTo: commissionDoctor.name,
      notes: 'Settlement for last month',
      doctorId: commissionDoctor.id,
    });
  }

  return db;
}
