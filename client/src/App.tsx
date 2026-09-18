import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Sessions from './pages/Sessions';
import CalendarPage from './pages/Calendar';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Doctors from './pages/Doctors';
import Prescription from './pages/Prescription';
import HepHandout from './pages/HepHandout';
import Staff from './pages/Staff';
import ActivityLog from './pages/ActivityLog';
import { Role } from './types';
import { canManageStaff, hasFinancialAccess } from '../../shared/roles';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * A client-side redirect for pages a role should not land on — good UX for a role that can no
 * longer see the "Payments" link but still had the URL from before. The real boundary is the
 * server's own role checks on every route; this only stops a confusing dead page from showing.
 */
function RoleGated({ allow, children }: { allow: (role: Role) => boolean; children: JSX.Element }) {
  const { user } = useAuth();
  if (user && !allow(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="patients/:id/prescription/:diagnosisId" element={<Prescription />} />
        <Route path="patients/:id/hep/:diagnosisId" element={<HepHandout />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="sessions" element={<Sessions />} />
        <Route
          path="doctors"
          element={
            <RoleGated allow={hasFinancialAccess}>
              <Doctors />
            </RoleGated>
          }
        />
        <Route
          path="payments"
          element={
            <RoleGated allow={hasFinancialAccess}>
              <Payments />
            </RoleGated>
          }
        />
        <Route
          path="expenses"
          element={
            <RoleGated allow={hasFinancialAccess}>
              <Expenses />
            </RoleGated>
          }
        />
        <Route
          path="reports"
          element={
            <RoleGated allow={hasFinancialAccess}>
              <Reports />
            </RoleGated>
          }
        />
        <Route
          path="analytics"
          element={
            <RoleGated allow={hasFinancialAccess}>
              <Analytics />
            </RoleGated>
          }
        />
        <Route
          path="settings"
          element={
            <RoleGated allow={hasFinancialAccess}>
              <Settings />
            </RoleGated>
          }
        />
        <Route
          path="staff"
          element={
            <RoleGated allow={canManageStaff}>
              <Staff />
            </RoleGated>
          }
        />
        <Route
          path="activity-log"
          element={
            <RoleGated allow={canManageStaff}>
              <ActivityLog />
            </RoleGated>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
