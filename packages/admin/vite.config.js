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
const roDateStr = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}).format(now);
const buildDateTime = roDateStr.replace(',', '');
const buildNumber = `${commitCount}${commitHash ? ` (${commitHash})` : ''}`;

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
    __BUILD_DATE__: JSON.stringify(buildDateTime),
  },
  server: { port: 4013, host: true }
});

