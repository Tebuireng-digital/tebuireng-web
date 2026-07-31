import type { CapacitorConfig } from '@capacitor/cli';

// Emulator Android mengakses host pengembang melalui 10.0.2.2. Untuk APK
// perangkat/produksi, ganti nilai ini saat sync, misalnya:
// CAPACITOR_SERVER_URL=https://absensi.example.org npm run android:apk
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim()
  || 'http://10.0.2.2:5173';
const parsedServerUrl = new URL(serverUrl);

const config: CapacitorConfig = {
  appId: 'id.or.tebuireng.absensi',
  appName: 'Absensi Tebuireng',
  webDir: 'dist',
  server: {
    url: serverUrl,
    cleartext: parsedServerUrl.protocol === 'http:',
    allowNavigation: [parsedServerUrl.hostname],
  },
  android: {
    backgroundColor: '#EEF1EC',
  },
};

export default config;
