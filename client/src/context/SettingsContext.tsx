import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { ExerciseOverrides } from '../../../shared/exerciseLibrary';

export interface ClinicSettings {
  clinicName: string;
  phone?: string | null;
  address?: string | null;
  checkupFee: number;
  defaultSessionFee: number;
  /** Printed along the bottom of the prescription. */
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  timings?: string | null;
  formTitle?: string | null;
  /** The prescription's tick-box columns. Empty means "use the standard list". */
  diagnosisOptions?: string[];
  exerciseOptions?: string[];
  modalityOptions?: string[];
  /** The clinic's departments. Empty means "use the standard list". */
  departmentOptions?: string[];
  /** The clinic's own rewrite of the built-in exercise library. Empty means "use the defaults". */
  exerciseLibrary?: ExerciseOverrides;
}

const fallback: ClinicSettings = {
  clinicName: 'Physio Fitness Clinic',
  checkupFee: 1000,
  defaultSessionFee: 1500,
};

interface SettingsContextValue {
  settings: ClinicSettings;
  reload: () => Promise<void>;
  save: (patch: Partial<ClinicSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: fallback,
  reload: async () => {},
  save: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ClinicSettings>(fallback);

  const reload = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch {
      /* keep fallback — the clinic name is cosmetic, never block the app on it */
    }
  }, []);

  const save = useCallback(
    async (patch: Partial<ClinicSettings>) => {
      const res = await api.put('/settings', patch);
      setSettings(res.data);
    },
    []
  );

  // Signing in is when the settings first become fetchable. Without watching the user, the
  // app ran on built-in defaults until the page happened to be reloaded — and the printed
  // prescription would have gone out with the wrong clinic details on it.
  useEffect(() => {
    reload();
  }, [reload, user?.id]);

  return (
    <SettingsContext.Provider value={{ settings, reload, save }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
