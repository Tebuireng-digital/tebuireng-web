import axios from 'axios';

const hostname = window.location.hostname || 'localhost';
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${hostname}:8000`;

const apiAssetBaseUrl = (() => {
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return API_BASE_URL;
  }

  if (API_BASE_URL.startsWith('/')) {
    return window.location.origin;
  }

  return new URL(API_BASE_URL, window.location.origin).toString();
})();

export function resolveApiAssetUrl(path?: string | null) {
  if (!path) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(path)) {
    return path;
  }

  return new URL(path, apiAssetBaseUrl).toString();
}

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
