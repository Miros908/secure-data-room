import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AUTH_ABUSE_LIMIT } from '../../src/modules/auth/auth.constants';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { TEST_PASSWORD } from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-11
 * login и register ограничены по частоте.
 */
describe('AUTH-11 rate limit on login and register', () => {
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

  it(`POST /auth/login returns 429 after ${AUTH_ABUSE_LIMIT} attempts`, async () => {
    const server = testApp.app.getHttpServer();
    const statuses: number[] = [];

    for (let i = 0; i < AUTH_ABUSE_LIMIT + 1; i += 1) {
      const response = await request(server)
        .post('/auth/login')
        .send({
          email: `brute-${randomUUID()}@example.test`,
          password: TEST_PASSWORD,
        });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });

  it(`POST /auth/register returns 429 after ${AUTH_ABUSE_LIMIT} attempts`, async () => {
    const server = testApp.app.getHttpServer();
    const statuses: number[] = [];

    for (let i = 0; i < AUTH_ABUSE_LIMIT + 1; i += 1) {
      const response = await request(server)
        .post('/auth/register')
        .send({
          email: `flood-${randomUUID()}@example.test`,
          password: TEST_PASSWORD,
          name: 'Flood',
        });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});
