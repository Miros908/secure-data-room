import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerSession } from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-08
 * Logout отзывает сессию на сервере, а не только стирает cookie у клиента.
 */
describe('AUTH-08 logout invalidates session', () => {
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

  it('POST /auth/logout then GET /auth/me with the same cookie → 401', async () => {
    const session = await registerSession(testApp.app);
    const server = testApp.app.getHttpServer();

    await request(server)
      .post('/auth/logout')
      .set('Cookie', session.cookie)
      .expect(200);

    const me = await request(server)
      .get('/auth/me')
      .set('Cookie', session.cookie);

    expect(me.status).toBe(401);
    expect(me.body).toMatchObject({ code: 'unauthorized' });
  });

  it('logout sets revoked_at on the session row', async () => {
    const session = await registerSession(testApp.app);

    await request(testApp.app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', session.cookie)
      .expect(200);

    const rows = await testApp.prisma.auth_sessions.findMany({
      where: { user_id: session.id },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].revoked_at).not.toBeNull();
  });
});
