import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

export interface ClinicSettings {
  clinicName: string;
  phone?: string | null;
  address?: string | null;
  checkupFee: number;
  defaultSessionFee: number;
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

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SettingsContext.Provider value={{ settings, reload, save }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
