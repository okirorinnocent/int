import { defineConfig } from 'vitest/config';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  server: { port: 3000 },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'] },
});
