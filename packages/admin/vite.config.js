import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

let commitCount = '883';
let commitHash = '';
try {
  commitCount = execSync('git rev-list --count HEAD').toString().trim();
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  // fallback if git command fails
}

const now = new Date();
const day = String(now.getDate()).padStart(2, '0');
const month = String(now.getMonth() + 1).padStart(2, '0');
const year = now.getFullYear();
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const buildDateTime = `${day}.${month}.${year} ${hours}:${minutes}`;
const buildNumber = `${commitCount}${commitHash ? ` (${commitHash})` : ''}`;

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
    __BUILD_DATE__: JSON.stringify(buildDateTime),
  },
  server: { port: 4013, host: true }
});

