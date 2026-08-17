import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { EVIL_ORIGIN, TEST_FRONTEND_ORIGIN } from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-16
 * CORS с credentials только для allowlist, не для произвольного Origin.
 */
describe('AUTH-16 CORS allowlist', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
  });

  it('preflight from a foreign origin is not granted credentials', async () => {
    const response = await request(testApp.app.getHttpServer())
      .options('/auth/me')
      .set('Origin', EVIL_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).not.toBe(
      EVIL_ORIGIN,
    );
  });

  it('allowlisted frontend origin receives ACAO and credentials', async () => {
    const response = await request(testApp.app.getHttpServer())
      .options('/auth/me')
      .set('Origin', TEST_FRONTEND_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe(
      TEST_FRONTEND_ORIGIN,
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
