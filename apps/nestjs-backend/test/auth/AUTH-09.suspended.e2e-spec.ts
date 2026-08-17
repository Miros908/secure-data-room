import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerSession, TEST_PASSWORD } from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-09
 * Блокировка пользователя сразу закрывает API по существующей cookie.
 */
describe('AUTH-09 suspended user is rejected immediately', () => {
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

  it('GET /auth/me with a valid cookie → 403 after status=SUSPENDED', async () => {
    const session = await registerSession(testApp.app);

    await testApp.prisma.users.update({
      where: { id: session.id },
      data: { status: 'SUSPENDED' },
    });

    const me = await request(testApp.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', session.cookie);

    expect(me.status).toBe(403);
    expect(me.body).toMatchObject({ code: 'forbidden' });
  });

  it('POST /auth/login with the correct password → 403 while suspended', async () => {
    const session = await registerSession(testApp.app);

    await testApp.prisma.users.update({
      where: { id: session.id },
      data: { status: 'SUSPENDED' },
    });

    const login = await request(testApp.app.getHttpServer())
      .post('/auth/login')
      .send({ email: session.email, password: TEST_PASSWORD });

    expect(login.status).toBe(403);
    expect(login.body).toMatchObject({ code: 'forbidden' });
  });
});
