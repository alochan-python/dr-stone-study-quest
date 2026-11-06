/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages のサブパス配信に合わせる
const base = '/dr-stone-study-quest/';

/** npm run dev の時だけ手元の画像パックを配信する。ビルド結果には含まれない */
function privateImagePack(): Plugin {
  const file = resolve(import.meta.dirname, 'private-assets/dr-stone-image-pack.json');
  return {
    name: 'private-image-pack',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(`${base}__private/image-pack.json`, (_req, res, next) => {
        if (!existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    privateImagePack(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Dr.STONE 勉強50日チャレンジ',
        short_name: '勉強50日',
        description: '宿題以外に毎日1問。50人のキャラクターを集める自主勉強スタンプアプリ。',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a1016',
        theme_color: '#0a1016',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
