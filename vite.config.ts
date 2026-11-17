import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// The page is built into dist/web, which the server serves; the package ships it already built. Two entries: the
// local page, and the team server's (`team.html`), which share the kit and the theme.
export default defineConfig({
  root: 'web',
  plugins: [vue(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./web', import.meta.url)) } },
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./web/index.html', import.meta.url)),
        team: fileURLToPath(new URL('./web/team.html', import.meta.url)),
      },
    },
  },
});
