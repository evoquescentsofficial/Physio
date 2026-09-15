# Physio Fitness Clinic — Patient Management System

A patient management system for physiotherapy clinics: patients, printable assessment &
prescription records, multi-session treatment packages, attendance, advances, installments,
expenses and profit &amp; loss reporting.

Amounts are shown in Pakistani Rupees (Rs).

## Features

**Patients**
- Add / edit / delete patients with full contact and medical details (phone, email, DOB, gender,
  blood group, occupation, referred by, attendant, emergency contact, address, notes)
- **Attendant** records whoever brings the patient in — a family member, a carer, a driver. It
  sits beside the patient's name on the form and is optional, since plenty come alone
- Live search by patient name, attendant, phone or email — staff often remember the son who books
  the appointments rather than the patient, so typing his name finds them, and the row shows which
  attendant matched
- Per-patient summary: package value, total paid, balance due, session progress

**Assessment & prescription**

The clinic's paper prescription pad, digitised. One record holds the whole assessment and
prints on A4 as the same sheet the clinic has always used.

- **The written sections**, in the order they appear on the paper: History → Initial evaluation
  & examination → Diagnosis → Treatment plan → Instructions → Referred to → Lab investigations /
  radiological findings → Medications → Remarks. Blank sections are simply left off the printout
- **Three tick-box columns** — Diagnosis, Therapeutic exercises, Modalities — with the clinic's
  standard options. Anything else can be typed straight into the column, and all three lists are
  editable in Settings, so the pad changes without touching the code
- **Condition library** of 26 common physiotherapy presentations. Type "slip disc", "back pain"
  or "frozen shoulder" and the matching condition appears; picking it fills the treatment plan
  with the standard protocol, sets the body region, and ticks the matching box. Anything not in
  the list can still be typed freely — the library is a shortcut, not a whitelist
  (`shared/conditions.ts`)
- A filled plan is never overwritten by a later template pick, and "Reset to the standard plan"
  puts it back if wanted
- **Structured fields**: body region, side, and a 0–10 pain score at assessment, so the clinic
  can report on what it treats and measure progress against a baseline
- **Reports & scans**: attach X-rays, MRI reports and lab results as PDFs or images (up to 10 MB
  each). They are listed on the record, open in a new tab, and are named on the printout. Files
  live beside the database on the clinic computer, and are deleted with the record they belong to
- **Straight into treatment**: after saving an assessment from the library, the app offers the
  package that usually follows it — sessions, frequency and fee pre-filled — and books the whole
  schedule in one click
- Assessments can be linked to treatment packages

**Printing the prescription**
- **Print** on any assessment opens the sheet exactly as it will come out of the printer: the
  logo and the doctors' credentials across the top, then Name · Date · Age / Sex on one line
- The three tick-box columns print with every option, ticked or not, so the sheet reads like the
  pad even where nothing was selected
- The **sessions already booked** print as a two-column table of dates, and the **Packages** box
  carries the consultation fee, number of sessions, total, paid and balance — taken from what the
  system already knows rather than written out again
- A signature line, the clinic's timings, phone, address, email and social handles finish the
  sheet. All of it is set in Settings, and the doctors shown are the ones marked "show on
  prescription"
- Screen furniture (sidebar, buttons) never reaches the paper, and the tick columns and money box
  are kept from splitting across two pages

**Doctors, departments and how they are paid**
- Add the physiotherapists working at the clinic with specialization, qualification, phone,
  email, joining date and notes
- **Departments**: a doctor can work in more than one (physiotherapy, neuro rehab, sports
  injury, chiropractic…). The list is editable in Settings
- **On salary** — a fixed monthly amount. **Post salaries** on the Doctors page writes them all
  to expenses for the chosen month in one click, dated the last day of that month. Running it
  twice is safe: a month already posted is skipped, so nobody is ever paid twice
- **On commission** — the doctor sits in the clinic and keeps a share of what their sessions
  bill, say 70% theirs and 30% the clinic's
- **Credentials** (one qualification per line) and a "show on prescription" switch decide who
  appears on the printed letterhead and what is printed under their name
- Consultation fee is optional — leave it blank when the clinic bills per package rather
  than per doctor
- Each card shows that doctor's sessions this month and completed sessions all time
- A doctor who has treated patients is marked as having left rather than deleted, so past
  sessions keep their name; they can be reactivated at any time

**Two kinds of fee**
- **Checkup fee** — charged once on the patient's first visit. The patient page shows a prompt
  until it has been recorded. **Record payment** opens a dialog already filled in with the
  standard fee, with one-tap choices for a quarter off, half off or free, so a family rate or a
  waived visit is recorded from the same place as a full-price one
- A discounted or waived visit records what was actually collected as the payment and what was
  given up as a discount, so revenue stays honest, the visit still appears in the patient's
  history, and the giveaway is visible in **Discounts given** on the Payments page
- **Session fee** — charged per session, either as a single paid session or inside a package.

**Treatment packages & sessions**
- **Three ways to sell a course**, chosen when the package is created:
  - **One-off** — a set number of sessions, paid as an advance plus installments
  - **Weekly** — so many sessions a week at a weekly fee, for so many weeks
  - **Monthly** — so many sessions a month at a monthly fee, for so many months
- A weekly or monthly package books one payment **per cycle**: "3 a week at Rs 4,500 for 4 weeks"
  becomes 12 sessions, Rs 18,000, and four dated payments. Underneath it is an ordinary package,
  so every money rule, report and P&L figure keeps working unchanged (`shared/packages.ts`)
- Sessions are spaced so the agreed number land in each cycle — 3 a week is every other day,
  12 a month every third day
- Define a one-off package: number of sessions × fee per session (total auto-calculated)
- Auto-generate the full session schedule at a chosen frequency (e.g. one session every 2 days)
- Standalone visits (initial consultation, follow-up) alongside package sessions
- Add a run of sessions in one go: choose how many and how many days apart, and the dates,
  session numbers and fees are filled in — numbering continues from the package's existing
  sessions, and the form warns if the run takes the package past the sessions paid for
- **New sessions are dated after the course already booked**, not from today, so they never land
  in the middle of a schedule that runs into next month and give the patient two appointments on
  one day. The gap between them is read from the dates already booked, so a further run keeps the
  rhythm the patient is used to. The form names the last booked date and the default can be
  overridden whenever the patient is coming sooner (`shared/scheduling.ts`)
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
- Carry forward a single missed session to a new date, from the patient's own session list or the
  clinic-wide sessions page — the date defaults to after everything else already booked, so a
  session missed mid-course is picked up at the end of it
- Bulk carry-forward: move all of a package's overdue pending sessions into next month at a chosen
  frequency — the original is marked `CARRIED_FORWARD` so history is never lost
- Quick filters: today, this week, this month, all overdue pending

**The payment plan**
- Against any package the clinic records an **advance**, then a **1st, 2nd, 3rd installment** and
  so on — the way it is actually agreed with the patient at the desk
- A weekly or monthly package starts with **one payment per cycle** as a suggestion; ask for a
  different number of installments and the balance is split that many ways instead
- **Every row can be changed**: move it to the date they agreed, re-price it, remove it, or add
  another. Rs 10,000 monthly package with Rs 2,000 advance, then Rs 4,000 on the 20th and
  Rs 4,000 on the 25th, is three edits
- The plan says whether it still adds up: *"Rs 4,000 of the Rs 8,000 balance has no date yet"*,
  or that it covers the balance in full
- Editing an installment already marked paid moves the payment it recorded with it, so the
  plan and the day's takings can never disagree
- None of this changes what the patient owes — the totals, revenue and P&L come from the package
  fee and the payments actually taken. The plan only says *when the money is expected*

**Payment reminders**
- Every package shows **the next payment due** on the record: the amount, the date, and whether
  it is due today, due in n days, or n days overdue
- The **dashboard opens with a "Payments due" list** — everything already overdue plus whatever
  falls due in the next week, with the patient's phone number, so they can be reminded before
  they arrive rather than chased afterwards
- A payment due **today is not overdue**. Overdue starts the day after
- `GET /api/reports/due-payments?days=7` is the same list, for any range up to 90 days

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
- Salaries, commission payouts, rent, utilities, equipment, marketing, maintenance and other
  categories. Salaries and commission settlements are linked to the doctor they were paid to
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
- Clinic name, phone, address and email (shown throughout the app and on the prescription)
- Default checkup fee and default session fee, so staff type less
- Everything printed on the prescription: its heading, the clinic's timings, website and
  Instagram, and the contents of all three tick-box columns
- The clinic's list of departments

**Access control**
- JWT authentication with Admin / Doctor / Receptionist roles
- Receptionists run the front desk — patients, bookings, attendance, taking payments — but
  cannot delete patients or payments, see expenses and the P&L, change clinic fees, or
  manage doctors and users
- Sign-in is rate limited (10 attempts per 15 minutes), and `/auth/me` reads the database
  rather than the token, so a role change or a closed account takes effect immediately
- Password change endpoint; the last remaining admin cannot be deleted

## Commission and settlement

A commission doctor and the clinic have to agree on one number at month end, and which way it
points depends on who took the money:

- **Commission is earned on sessions the patient actually attended.** A booking nobody turned up
  for earned nothing.
- **If the front desk took the payment**, the clinic is holding the doctor's share and owes it
  to them.
- **If the doctor took it at the chair**, they are holding the clinic's commission and owe that
  back. Recording a payment offers "who took the money?" whenever the clinic has commission
  doctors.
- **Payouts are expenses.** Paying a doctor their share records a commission expense, so it
  reaches the P&L and comes off what is still owed.

The Doctors page shows, per doctor and per month: sessions, what they billed, the doctor's
share, what the clinic keeps, what they took at the chair, what has already been paid, and the
closing settlement — labelled *Clinic owes the doctor*, *Doctor owes the clinic*, or *Settled
up*. One definition in `shared/commission.ts`, used by the API, the app and the demo alike.

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
- **A discount is not revenue.** Only what was collected counts; the concession is recorded
  separately so it can be totalled without inflating income.

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
  src/routes/               auth, patients, doctors, diagnoses, attachments, packages, visits,
                            payments, expenses, reports, settings
  uploads/                  attached reports and scans (not in version control)
  src/middleware/           JWT auth, role guards, error handling
client/
  src/pages/                Login, Dashboard, Patients, PatientDetail, Prescription, Sessions,
                            Doctors, Payments, Expenses, Reports, Settings
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
| POST   | `/api/diagnoses`                    | Save an assessment & prescription           |
| GET    | `/api/diagnoses/:id`                | One assessment with its attachments         |
| POST   | `/api/attachments`                  | Attach a report or scan (multipart)         |
| GET    | `/api/attachments/:id/file`         | Open an attached file                       |
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
| GET    | `/api/reports/due-payments?days=7`  | Payments due soon, and anything overdue     |
| GET    | `/api/doctors/earnings?from=&to=`   | Each doctor's earnings and settlement       |
| POST   | `/api/doctors/post-salaries`        | Post a month's salaries to expenses         |
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
- **No toast notifications.** Destructive actions confirm in-app and show their errors, but a
  successful save gives no visible acknowledgement beyond the list updating.
- **Deletes are hard deletes.** Removing a patient removes their history with them.
- **No appointment times.** Sessions have a date but no time, duration or double-booking check.
