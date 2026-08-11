# PhysioCare — Patient Management System

A patient management system for physiotherapy clinics: patients, diagnoses, multi-session
treatment packages, attendance, advances, installments, expenses and profit &amp; loss reporting.

## Features

**Patients**
- Add / edit / delete patients with full contact and medical details (phone, email, DOB, gender,
  blood group, occupation, referred by, emergency contact, address, notes)
- Live search by name, phone or email
- Per-patient dashboard: total billed, total paid, balance due, session progress

**Diagnoses & treatment**
- Multiple diagnoses per patient with clinical details, treatment plan, remarks and attending doctor
- Diagnoses can be linked to treatment packages

**Treatment packages & sessions**
- Define a package: number of sessions × fee per session (total auto-calculated)
- Auto-generate the full session schedule at a chosen frequency (e.g. one session every 2 days)
- Standalone visits (initial consultation, follow-up) alongside package sessions
- Per-session fee and per-session treatment notes

**Attendance & carry-forward**
- Mark each scheduled session Present / Absent / Cancelled on the day it was scheduled
- Carry forward a single missed session to a new date
- Bulk carry-forward: move all of a package's overdue pending sessions into next month at a chosen
  frequency — the original is marked `CARRIED_FORWARD` so history is never lost
- Quick filters: today, this week, this month, all overdue pending

**Payments**
- Record advances, session fees, visit fees, installment payments and refunds
- Payment methods: cash, card, UPI, bank transfer, other
- Payments can be tied to a package or a specific visit (marks the visit fee as collected)
- Outstanding dues list, ranked by amount owed

**Installments**
- Split a package total into N monthly installments at creation time, or add them individually
- Due dates, paid dates, and automatic overdue highlighting

**Expenses**
- Salaries, rent, utilities, equipment, marketing, maintenance and other categories
- Filter by date range and category, with per-category totals

**Reports**
- Dashboard: revenue / expenses / profit this month, outstanding dues, overdue pending sessions,
  today's schedule
- Revenue trend, revenue by payment type, revenue vs expenses, expenses by category
- Profit &amp; loss statement by month with margins and totals, exportable as CSV

**Access control**
- JWT authentication with Admin / Doctor / Receptionist roles; admins can manage users

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
# edit server/.env and set a strong JWT_SECRET

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

## Project structure

```
server/
  prisma/schema.prisma      data model
  prisma/seed.ts            seeds the initial admin user
  src/routes/               auth, patients, diagnoses, packages, visits, payments, expenses, reports
  src/middleware/           JWT auth, role guards, error handling
client/
  src/pages/                Login, Dashboard, Patients, PatientDetail, Sessions, Payments, Expenses, Reports
  src/components/           Layout (sidebar nav) and shared UI primitives
  src/context/              auth state
```

## API overview

All routes except `POST /api/auth/login` require an `Authorization: Bearer <token>` header.

| Method | Endpoint                            | Purpose                                     |
| ------ | ----------------------------------- | ------------------------------------------- |
| POST   | `/api/auth/login`                   | Sign in                                     |
| GET    | `/api/patients?q=`                  | List / search patients                      |
| GET    | `/api/patients/:id`                 | Full patient record with all relations      |
| POST   | `/api/diagnoses`                    | Add a diagnosis                             |
| POST   | `/api/packages`                     | Create a package (optionally auto-scheduling sessions and installments) |
| POST   | `/api/packages/:id/installments`    | Add an installment                          |
| POST   | `/api/visits/:id/attendance`        | Mark Present / Absent / Cancelled           |
| POST   | `/api/visits/:id/carry-forward`     | Carry one session to a new date             |
| POST   | `/api/visits/carry-forward-pending` | Carry all overdue pending sessions forward  |
| POST   | `/api/payments`                     | Record an advance / fee / installment       |
| GET    | `/api/expenses`                     | List expenses by range and category         |
| GET    | `/api/reports/dashboard`            | Dashboard summary                           |
| GET    | `/api/reports/profit-loss?months=6` | Monthly P&amp;L with totals                 |
| GET    | `/api/reports/outstanding`          | Packages with an unpaid balance             |

## Notes on data

Currency is formatted as INR (`en-IN`). To change it, edit the `currency()` helper in
`client/src/components/ui.tsx`.

SQLite has no native enum type, so status fields (attendance, payment type, expense category, …)
are stored as strings and validated with Zod at the API boundary. The allowed values for each are
documented in comments in `server/prisma/schema.prisma`.
