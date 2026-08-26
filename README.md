# Physio Fitness Clinic — Patient Management System

A patient management system for physiotherapy clinics: patients, diagnoses, multi-session
treatment packages, attendance, advances, installments, expenses and profit &amp; loss reporting.

Amounts are shown in Pakistani Rupees (Rs).

## Features

**Patients**
- Add / edit / delete patients with full contact and medical details (phone, email, DOB, gender,
  blood group, occupation, referred by, emergency contact, address, notes)
- Live search by name, phone or email
- Per-patient summary: package value, total paid, balance due, session progress

**Diagnoses & treatment**
- Multiple diagnoses per patient with clinical details, treatment plan, remarks and attending doctor
- Diagnoses can be linked to treatment packages

**Doctors**
- Add the physiotherapists working at the clinic with specialization, qualification, phone,
  email, joining date and notes
- Consultation fee is optional — leave it blank when the clinic bills per package rather
  than per doctor
- Each card shows that doctor's sessions this month and completed sessions all time
- A doctor who has treated patients is marked as having left rather than deleted, so past
  sessions keep their name; they can be reactivated at any time

**Two kinds of fee**
- **Checkup fee** — charged once on the patient's first visit. The patient page shows a prompt
  until it has been recorded, and one click records it at the clinic's default rate.
- **Session fee** — charged per session, either as a single paid session or inside a package.

**Treatment packages & sessions**
- Define a package: number of sessions × fee per session (total auto-calculated)
- Auto-generate the full session schedule at a chosen frequency (e.g. one session every 2 days)
- Standalone visits (initial consultation, follow-up) alongside package sessions
- Add a run of sessions in one go: choose how many and how many days apart, and the dates,
  session numbers and fees are filled in — numbering continues from the package's existing
  sessions, and the form warns if the run takes the package past the sessions paid for
- Extend a finished package: book N more sessions and, when they are chargeable, the
  package's session count and total fee rise to match so the extra work is billed
- Assign a doctor when booking sessions, and reassign any session later from a dropdown in
  either the patient's session list or the clinic-wide sessions page
- Filter the clinic-wide session list by doctor to see one therapist's workload
- Per-session fee and per-session treatment notes
- Cancel a session (keeps the record) or delete it outright; deletion is refused when a
  payment is attached to it, so the money trail cannot be orphaned

**Attendance & carry-forward**
- Mark each scheduled session Present / Absent / Cancelled on the day it was scheduled
- Carry forward a single missed session to a new date
- Bulk carry-forward: move all of a package's overdue pending sessions into next month at a chosen
  frequency — the original is marked `CARRIED_FORWARD` so history is never lost
- Quick filters: today, this week, this month, all overdue pending

**Payments**
- Record advances, session fees, visit fees, installment payments and refunds
- Payment methods: cash, card, mobile wallet, bank transfer, other
- Payments can be tied to a package or a specific visit (marks the visit fee as collected)
- Outstanding dues list, ranked by amount owed

**Installments**
- The usual flow: patient pays an **advance** at the start, and the remaining balance is split
  into 2, 3 or more **monthly installments** — enter the advance and the number of installments
  when creating the package and both are generated automatically
- Rounding goes into the last installment, so the parts always add up to the balance exactly
- Add installments individually too; due dates, paid dates and automatic overdue highlighting

**Expenses**
- Salaries, rent, utilities, equipment, marketing, maintenance and other categories
- Filter by date range and category, with per-category totals

**Reports**
- Dashboard: today's schedule with live attendance, revenue / expenses / profit this month,
  outstanding dues and credits held, patient and package counts, overdue sessions
- Revenue trend, revenue by payment type, revenue vs expenses, expenses by category
- Date range on every report: today, last 7 days, last 30 days (the default), last 3 or 12
  months, or a custom from/to range
- Figures are grouped by day, week or month automatically depending on how long the range is
- Profit &amp; loss statement with margins and totals, exportable as CSV

**Settings**
- Clinic name, phone and address (shown throughout the app)
- Default checkup fee and default session fee, so staff type less

**Access control**
- JWT authentication with Admin / Doctor / Receptionist roles
- Receptionists run the front desk — patients, bookings, attendance, taking payments — but
  cannot delete patients or payments, see expenses and the P&L, change clinic fees, or
  manage doctors and users
- Sign-in is rate limited (10 attempts per 15 minutes), and `/auth/me` reads the database
  rather than the token, so a role change or a closed account takes effect immediately
- Password change endpoint; the last remaining admin cannot be deleted

## How money is counted

All three surfaces — API, web client and demo — import `shared/money.ts`, so there is one
definition of every rule rather than one per codebase:

- **Refunds are negative.** They reduce revenue, profit and the patient's paid total.
- **Only packages create a debt.** Checkup and single-session fees are settled as they
  happen; an advance or installment with no package named is money on account.
- **Overpayment becomes credit** on the patient's account and is applied to their next package.
- **Marking an installment paid records a Payment** in the same transaction, so the cash
  reaches revenue and the balance. Reopening it removes that payment again.
- **Installment rounding** goes on the last installment, so the parts sum to the balance exactly.
- **OVERDUE is derived, never stored** — it is a fact about today, so a nightly job cannot
  get it wrong between runs.

`npm test --prefix server` runs the unit tests covering these rules.

## Tech stack

| Layer    | Stack                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, React Router |
| Backend  | Node.js, Express, TypeScript, Zod validation                 |
| Database | SQLite via Prisma ORM (swap to PostgreSQL/MySQL by changing the datasource) |
| Auth     | JWT + bcrypt                                                 |

## Getting started

```bash
# 1. Install dependencies for both apps
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env
# edit server/.env and set a strong JWT_SECRET (32+ characters).
# In production the server refuses to start without one.

# 3. Create the database and seed the admin user
npm run db:migrate
npm run db:seed

# 4. Run both apps (API on :4000, UI on :5173)
npm run dev
```

Open http://localhost:5173 and sign in with:

- **Email:** `admin@physio.clinic`
- **Password:** `admin123`

Change this password (or create a new admin and delete this one) before using the system for real
patient data.

### On Windows

1. Install [Node.js](https://nodejs.org) (LTS version) — accept all defaults.
2. Open **PowerShell**, then move into the project folder, e.g. `cd C:\Users\You\Physio`.
3. Run the same four commands above, but use this instead of the `cp` line:
   `copy server\.env.example server\.env`
4. Leave the window open while you use the app — closing it stops the server.

## Trying it without installing anything

`npm run build:demo --prefix client` produces `client/dist/index.html`: a single self-contained
file that runs the entire app in the browser against sample clinic data held in `localStorage`.
No server, no database, no install — open the file (or host it anywhere) and press Sign in.

Use it to explore the workflow or to show someone the system. Anything entered there is saved
only in that browser and never reaches a real database; **Reset demo** in the top bar restores
the original sample data.

## Project structure

```
server/
  prisma/schema.prisma      data model
  prisma/seed.ts            seeds the initial admin user
  src/routes/               auth, patients, doctors, diagnoses, packages, visits, payments,
                            expenses, reports, settings
  src/middleware/           JWT auth, role guards, error handling
client/
  src/pages/                Login, Dashboard, Patients, PatientDetail, Sessions, Doctors,
                            Payments, Expenses, Reports, Settings
  src/components/           Layout (sidebar nav) and shared UI primitives
  src/context/              auth state and clinic settings
  src/api/                  API client, plus the in-browser store used by the demo build
```

## API overview

All routes except `POST /api/auth/login` require an `Authorization: Bearer <token>` header.

| Method | Endpoint                            | Purpose                                     |
| ------ | ----------------------------------- | ------------------------------------------- |
| POST   | `/api/auth/login`                   | Sign in                                     |
| POST   | `/api/auth/change-password`         | Change your own password                    |
| GET    | `/api/patients?q=`                  | List / search patients                      |
| GET    | `/api/doctors`                      | List doctors with session counts            |
| POST   | `/api/doctors`                      | Add a doctor                                |
| DELETE | `/api/doctors/:id`                  | Remove, or deactivate if they have sessions |
| GET    | `/api/patients/:id`                 | Full patient record with all relations      |
| POST   | `/api/diagnoses`                    | Add a diagnosis                             |
| POST   | `/api/packages`                     | Create a package (optionally auto-scheduling sessions and installments) |
| POST   | `/api/packages/:id/installments`    | Add an installment                          |
| POST   | `/api/packages/:id/extend`          | Book more sessions, optionally billing them |
| POST   | `/api/visits/:id/attendance`        | Mark Present / Absent / Cancelled           |
| POST   | `/api/visits/:id/carry-forward`     | Carry one session to a new date             |
| POST   | `/api/visits/carry-forward-pending` | Carry all overdue pending sessions forward  |
| POST   | `/api/payments`                     | Record an advance / fee / installment       |
| GET    | `/api/expenses`                     | List expenses by range and category         |
| GET    | `/api/reports/dashboard`            | Dashboard summary                           |
| GET    | `/api/reports/profit-loss?days=30`  | P&amp;L for a range (`days=N`, or `from`/`to`) |
| GET    | `/api/reports/outstanding`          | Patients owing money                        |
| GET    | `/api/reports/credits`              | Patients holding a credit balance           |
| GET    | `/api/settings`                     | Clinic name and default fees                |
| PUT    | `/api/settings`                     | Update clinic details and default fees      |

## Notes on data

Currency is formatted as PKR (`en-PK`), rendering as `Rs 1,500`. To change it, edit the
`currency()` helper in `client/src/components/ui.tsx`.

The clinic logo is inline SVG in `client/src/components/Logo.tsx`. To use an image file instead,
put it at `client/public/logo.png` and replace that component's contents with
`<img src="/logo.png" />`.

SQLite has no native enum type, so status fields (attendance, payment type, expense category, …)
are stored as strings and validated with Zod at the API boundary. The allowed values for each are
documented in comments in `server/prisma/schema.prisma`.

## Known limitations

Deliberate gaps, in the order they should be closed:

- **Money is stored as `Float`.** Correct today because every amount is a whole rupee, but
  it should be integer paisa (or Postgres `Decimal`) before the data grows.
- **Dates are timezone-naive.** Appointment dates are stored as timestamps and compared
  against server-local day boundaries. Correct in PKT; wrong on a negative UTC offset.
  Needs date-only storage plus a clinic timezone setting.
- **No pagination.** Every list endpoint returns the whole table.
- **SQLite** is single-writer and single-machine — fine for one front desk, not for two.
- **No audit trail.** Nothing records who took a payment or edited a record.
- **Deletes are hard deletes.** Removing a patient removes their history with them.
- **No appointment times.** Sessions have a date but no time, duration or double-booking check.
