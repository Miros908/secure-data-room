import { config } from 'dotenv';
import { resolve } from 'node:path';

process.env.NODE_ENV = 'test';

const loaded = config({
  path: resolve(__dirname, '..', '.env.test'),
  quiet: true,
});
if (loaded.error) {
  throw loaded.error;
}

assertTestDatabase(process.env.DATABASE_URL);

function assertTestDatabase(url: string | undefined): void {
  if (!url) {
    throw new Error('DATABASE_URL is not set for e2e tests');
  }

  const database = new URL(url).pathname.replace(/^\//, '');
  if (database !== 'secure_data_room_test') {
    throw new Error(
      `E2E refuses DATABASE_URL database "${database}". Expected secure_data_room_test.`,
    );
  }
}
