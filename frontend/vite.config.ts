import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Sistem Pendataan Pesantren Putra',
        short_name: 'Absensi Putra',
        description: 'Aplikasi Absensi dan Perizinan Pesantren Putra',
        theme_color: '#EEF1EC',
        background_color: '#EEF1EC',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      }
    })
  ]
});
