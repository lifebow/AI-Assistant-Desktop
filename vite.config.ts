import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Ensure relative paths for Electron
  plugins: [
    react(),
    electron([
      {
        // Main process entry
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'electron-store', 'electron-updater'],
            },
          },
        },
      },
      {
        // Preload script
        entry: 'electron/preload.ts',
        onstart(options) {
          // Notify the Renderer process to reload the page when the Preload scripts build is complete
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.js',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        // Crop overlay preload script
        entry: 'electron/crop-preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'electron/crop-preload.ts',
              formats: ['cjs'],
              fileName: () => 'crop-preload.js',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        crop: resolve(__dirname, 'src/crop/index.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
});