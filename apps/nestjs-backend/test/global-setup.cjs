const { execSync } = require('node:child_process');
const path = require('node:path');
const { config } = require('dotenv');

module.exports = function globalSetup() {
  process.env.NODE_ENV = 'test';
  const loaded = config({
    path: path.join(__dirname, '..', '.env.test'),
    quiet: true,
  });
  if (loaded.error) {
    throw loaded.error;
  }

  const database = new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '');
  if (database !== 'secure_data_room_test') {
    throw new Error(
      `E2E refuses DATABASE_URL database "${database}". Expected secure_data_room_test.`,
    );
  }

  execSync('pnpm --filter @sdr/shared build', {
    cwd: path.join(__dirname, '..', '..', '..'),
    env: process.env,
    stdio: 'inherit',
  });
  execSync('pnpm prisma generate && pnpm prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
};
