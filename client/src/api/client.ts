import axios from 'axios';
import { demoAdapter } from './demoAdapter';

/** Demo builds run against an in-browser store instead of the HTTP API. */
export const IS_DEMO = import.meta.env.VITE_DEMO === '1';

export const api = axios.create({
  baseURL: '/api',
  ...(IS_DEMO ? { adapter: demoAdapter } : {}),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (IS_DEMO) {
        if (!window.location.hash.startsWith('#/login')) window.location.hash = '#/login';
      } else if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
