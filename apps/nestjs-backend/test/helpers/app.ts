import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { REQUEST_ID_HEADER } from '@sdr/shared/http';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { parseCorsOrigin } from '../../src/cors-origin';
import { PrismaService } from '../../src/database/prisma.service';
import { requestIdMiddleware } from '../../src/request-id.middleware';

const APP_TABLES = [
  'activity_events',
  'public_share_links',
  'access_invitations',
  'access_grants',
  'file_versions',
  'files',
  'folders',
  'data_rooms',
  'auth_tokens',
  'auth_sessions',
  'oauth_accounts',
  'users',
] as const;

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  logs: string[];
  port: number;
};

export async function createTestApp(): Promise<TestApp> {
  const logs: string[] = [];
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({
    forceCloseConnections: true,
  });
  app.useLogger({
    log: (message) => logs.push(String(message)),
    error: (message) => logs.push(String(message)),
    warn: (message) => logs.push(String(message)),
    debug: () => undefined,
    verbose: () => undefined,
    fatal: (message) => logs.push(String(message)),
  });
  app.use(requestIdMiddleware);
  app.use(cookieParser());
  app.enableCors({
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  await app.listen(0);

  return {
    app,
    prisma: app.get(PrismaService),
    logs,
    port: listenPort(app),
  };
}

function listenPort(app: INestApplication): number {
  const address = app.getHttpServer().address();
  if (!address || typeof address === 'string') {
    throw new Error('test app did not bind a TCP port');
  }
  return address.port;
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = APP_TABLES.map((name) => `"${name}"`).join(', ');
  const sql = `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await prisma.$executeRawUnsafe(sql);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableTruncate(error) || attempt === 7) {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 40 * 2 ** attempt);
      });
    }
  }

  throw lastError;
}

function isRetryableTruncate(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('40P01') ||
    message.includes('55P03') ||
    message.includes('deadlock')
  );
}
