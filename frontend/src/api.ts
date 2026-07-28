import axios from 'axios';

const hostname = window.location.hostname || 'localhost';

// Konfigurasi axios untuk Sanctum SPA
export const api = axios.create({
  baseURL: `http://${hostname}:8000`, // Backend Laravel mengikuti host frontend (localhost / 127.0.0.1)
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});
