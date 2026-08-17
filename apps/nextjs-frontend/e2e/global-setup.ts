import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const backendRoot = path.join(process.cwd(), '../nestjs-backend');

export default function globalSetup() {
  const envTest = parseEnvFile(path.join(backendRoot, '.env.test'));
  const databaseUrl = envTest.DATABASE_URL;
  assertTestDatabase(databaseUrl);

  execSync('pnpm --filter @sdr/shared build', {
    cwd: path.join(process.cwd(), '../..'),
    env: process.env,
    stdio: 'inherit',
  });
  execSync('pnpm prisma generate && pnpm prisma migrate deploy', {
    cwd: backendRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
    },
    stdio: 'inherit',
  });
}

function assertTestDatabase(url: string | undefined) {
  if (!url) {
    throw new Error('DATABASE_URL is missing from apps/nestjs-backend/.env.test');
  }

  const database = new URL(url).pathname.replace(/^\//, '');
  if (database !== 'secure_data_room_test') {
    throw new Error(
      `Web e2e refuses DATABASE_URL database "${database}". Expected secure_data_room_test.`,
    );
  }
}

export function parseEnvFile(filePath: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
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
