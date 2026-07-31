# Wrapper Android

Aplikasi Android memakai Capacitor dan membuka frontend web di dalam WebView native. Dengan cara ini autentikasi cookie, service worker, antrean offline, dan routing tetap dijalankan oleh website yang sama.

## Build APK

Kebutuhan: Node.js 24+, Java 21, Android SDK Platform 36, dan Build Tools 35.

Untuk server produksi (wajib HTTPS):

```bash
cd frontend
npm ci
CAPACITOR_SERVER_URL=https://domain-absensi.example.org npm run android:apk
```

APK debug yang dapat langsung dipasang berada di:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Untuk emulator lokal, jalankan frontend dan backend seperti biasa lalu build tanpa environment variable. Nilai bawaan `http://10.0.2.2:5173` adalah alamat host komputer dari Android Emulator.

Untuk perangkat fisik di jaringan Wi-Fi yang sama, pakai IP LAN komputer dan pastikan Vite mendengarkan pada semua interface:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
CAPACITOR_SERVER_URL=http://192.168.1.10:5173 npm run android:apk
```

Ganti `192.168.1.10` dengan IP komputer. Backend port `8000` juga harus dapat dijangkau perangkat; frontend otomatis memakai hostname website yang sedang dibuka.

## Instalasi

Dengan perangkat yang sudah mengaktifkan USB debugging:

```bash
adb install -r frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

APK debug ditandatangani dengan debug key dan cocok untuk pengujian/distribusi internal. Untuk Play Store atau distribusi resmi, buka project melalui `npm run android:open`, buat signing key milik organisasi, lalu hasilkan signed App Bundle/APK dari Android Studio. Jangan commit signing key atau password-nya.

Setelah frontend atau plugin native berubah, `npm run android:apk` otomatis menjalankan build web, sinkronisasi Capacitor, dan build Gradle.
