import axios from 'axios';

const hostname = window.location.hostname || 'localhost';
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${hostname}:8000`;

// Konfigurasi axios untuk Sanctum SPA
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Accept': 'application/json',
  },
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const isSantriPortal = window.location.pathname.startsWith('/portal-santri');
      const isRoleSelection = window.location.pathname === '/' || window.location.pathname === '/pilih-login';
      if (isRoleSelection) return Promise.reject(error);
      const loginPath = isSantriPortal ? '/portal-santri/login?reason=session-expired' : '/login?reason=session-expired';
      if (window.location.pathname !== loginPath.split('?')[0]) window.location.assign(loginPath);
    }

    return Promise.reject(error);
  },
);
