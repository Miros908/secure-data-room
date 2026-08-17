import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  EVIL_ORIGIN,
  registerSession,
  TEST_FRONTEND_ORIGIN,
} from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-05
 * Mutating запрос с cookie и чужим Origin не выполняется.
 */
describe('AUTH-05 CSRF origin check', () => {
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

  it('POST /auth/logout with a foreign Origin → 403 and session stays valid', async () => {
    const session = await registerSession(testApp.app);
    const server = testApp.app.getHttpServer();

    const logout = await request(server)
      .post('/auth/logout')
      .set('Cookie', session.cookie)
      .set('Origin', EVIL_ORIGIN);

    expect(logout.status).toBe(403);
    expect(logout.body).toMatchObject({ code: 'forbidden' });

    const me = await request(server)
      .get('/auth/me')
      .set('Cookie', session.cookie)
      .expect(200);

    expect(me.body).toMatchObject({ id: session.id, email: session.email });
  });

  it('POST /auth/logout from the frontend origin still invalidates the session', async () => {
    const session = await registerSession(testApp.app);
    const server = testApp.app.getHttpServer();

    await request(server)
      .post('/auth/logout')
      .set('Cookie', session.cookie)
      .set('Origin', TEST_FRONTEND_ORIGIN)
      .expect(200);

    const me = await request(server)
      .get('/auth/me')
      .set('Cookie', session.cookie);

    expect(me.status).toBe(401);
  });
});
