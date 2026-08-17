import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AUTH_ABUSE_LIMIT } from '../../src/modules/auth/auth.constants';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';

/**
 * Чек-лист §3 SHARE-19
 * Публичные resolve/token endpoints ограничены по частоте.
 */
describe('SHARE-19 public endpoints are rate limited', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    process.env.E2E_THROTTLE = '1';
    testApp = await createTestApp();
  });

  afterAll(async () => {
    delete process.env.E2E_THROTTLE;
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
  });

  it(`GET /access/public-links/resolve returns 429 after ${AUTH_ABUSE_LIMIT} attempts`, async () => {
    const statuses: number[] = [];

    for (let i = 0; i < AUTH_ABUSE_LIMIT + 1; i += 1) {
      const response = await request(testApp.app.getHttpServer()).get(
        `/access/public-links/resolve?token=brute-${randomUUID()}`,
      );
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  it(`GET /files/:id?token= returns 429 after ${AUTH_ABUSE_LIMIT} attempts`, async () => {
    const fileId = randomUUID();
    const statuses: number[] = [];

    for (let i = 0; i < AUTH_ABUSE_LIMIT + 1; i += 1) {
      const response = await request(testApp.app.getHttpServer()).get(
        `/files/${fileId}?token=brute-${randomUUID()}`,
      );
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
