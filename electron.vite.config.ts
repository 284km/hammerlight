import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: {
          ui: resolve(__dirname, 'src/ui/index.html'),
          overlay: resolve(__dirname, 'src/overlay/index.html'),
        },
      },
    },
  },
});
