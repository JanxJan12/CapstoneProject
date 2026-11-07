import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '../..');
export default defineConfig({
  root: import.meta.dirname,
  envDir: false,
  define: {
    'import.meta.env.VITE_DEMO_MODE': JSON.stringify('true'),
    'import.meta.env.VITE_GCASH_MERCHANT_NUMBER': JSON.stringify(''),
    'import.meta.env.VITE_GCASH_MERCHANT_NAME': JSON.stringify(''),
  },
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: '@/lib/supabase', replacement: path.join(import.meta.dirname, 'supabaseMock.ts') },
    { find: '@', replacement: path.join(repo, 'src') },
  ] },
  server: { host: '127.0.0.1', port: 58447, strictPort: true, fs: { allow: [repo] } },
});
