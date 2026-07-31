import axios from 'axios';

const hostname = window.location.hostname || 'localhost';
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${hostname}:8000`;

// Konfigurasi axios untuk Sanctum SPA
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});
