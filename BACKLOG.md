# Backlog

Features discussed and deliberately deferred — not started, not scheduled, just not lost.

## Configurable role permissions

Right now the four roles (Admin, Doctor, Junior doctor, Receptionist) and what each one can do
are fixed in code (`shared/roles.ts` — `hasFinancialAccess`, `canDeleteRecords`, `canReview`,
`canManageStaff` — enforced by the matching route guards in `server/src/middleware/auth.ts`).
The Staff page (`/staff`) shows what each role can do and lets an admin assign a role to a
person, but there is no screen to change what a role itself means.

**The ask**: a real permissions matrix an admin can edit from the UI — e.g. a "Permissions" tab
in Settings where individual capabilities (view payments, delete records, access reports, …) can
be toggled per role, rather than being hardcoded.

**What that would take**:
- A permissions table in the database (role → capability → allowed), replacing the hardcoded
  boolean functions in `shared/roles.ts`.
- A settings screen to view and edit that matrix.
- Swapping every route guard and client-side `hidden`/`showFinancials`-style check from a
  hardcoded function call to a lookup against the stored matrix.
- Deciding what happens to the fixed roles that exist today when this lands — migrate them to
  matching rows in the new table so nobody's access silently changes.

Not started. Revisit when it's actually needed.
