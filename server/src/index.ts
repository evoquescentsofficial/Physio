import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

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
  console.log(`Physio PMS API running on http://localhost:${PORT}`);
});
