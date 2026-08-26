import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patients.routes';
import diagnosisRoutes from './routes/diagnoses.routes';
import packageRoutes from './routes/packages.routes';
import visitRoutes from './routes/visits.routes';
import paymentRoutes from './routes/payments.routes';
import expenseRoutes from './routes/expenses.routes';
import reportRoutes from './routes/reports.routes';
import settingsRoutes from './routes/settings.routes';
import doctorRoutes from './routes/doctors.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = config.PORT;

app.use(helmet());
// A wildcard origin lets any site call the API with a user's credentials.
app.use(cors({ origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
// Cap the body so a single request cannot exhaust memory.
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Login is the one unauthenticated write, so it is the one worth throttling:
// without this, the seeded admin account can be brute-forced at full speed.
app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/diagnoses', diagnosisRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/doctors', doctorRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Physio PMS API running on http://localhost:${PORT} [${config.NODE_ENV}]`);
});
