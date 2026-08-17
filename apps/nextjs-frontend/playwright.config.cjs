const fs = require('node:fs');
const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

const WEB_ORIGIN = 'http://localhost:3100';
const API_ORIGIN = 'http://localhost:4010';
const WEB_PORT = '3100';
const API_PORT = '4010';

const root = __dirname;
const backendRoot = path.join(root, '../nestjs-backend');
const envTest = parseEnvFile(path.join(backendRoot, '.env.test'));

if (!envTest.DATABASE_URL || !envTest.DATABASE_URL.includes('secure_data_room_test')) {
  throw new Error(
    'Playwright refuses to start: .env.test must point at secure_data_room_test',
  );
}

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: WEB_ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/start-stack.cjs',
    cwd: root,
    url: `${WEB_ORIGIN}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: envTest.DATABASE_URL,
      PORT: API_PORT,
      E2E_WEB_PORT: WEB_PORT,
      CORS_ORIGIN: WEB_ORIGIN,
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: envTest.STORAGE_LOCAL_DIR ?? '.storage-test',
      STORAGE_KEY_PREFIX: envTest.STORAGE_KEY_PREFIX ?? 'test',
      STORAGE_PUBLIC_BASE_URL: API_ORIGIN,
      STORAGE_LOCAL_SIGNING_SECRET:
        envTest.STORAGE_LOCAL_SIGNING_SECRET ?? 'e2e-local-signing-secret',
      NEXT_PUBLIC_API_URL: API_ORIGIN,
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
});

function parseEnvFile(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator);
    let value = trimmed.slice(separator + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}
