import request from 'supertest';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/auth.constants';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerSession, TEST_PASSWORD } from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-02, AUTH-03, AUTH-04
 * Identity с сессии, токен не в JSON, cookie HttpOnly.
 */
describe('AUTH-02-04 session cookie contract', () => {
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

  it('AUTH-02 GET /auth/me identity comes from the session cookie, not the body', async () => {
    const session = await registerSession(testApp.app);

    const me = await request(testApp.app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', session.cookie)
      .expect(200);

    expect(me.body).toEqual({
      id: session.id,
      email: session.email,
      name: session.name,
    });
  });

  it('AUTH-02 unknown fields such as userId on create folder are rejected', async () => {
    const session = await registerSession(testApp.app);
    const rooms = await request(testApp.app.getHttpServer())
      .get('/data-rooms')
      .set('Cookie', session.cookie)
      .expect(200);

    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', session.cookie)
      .send({
        name: 'Injected',
        dataRoomId: rooms.body.myRoom.id,
        userId: '11111111-1111-4111-8111-111111111111',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation_error' });
  });

  it('AUTH-03 register JSON has no token; session is only in Set-Cookie', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `auth-json-${Date.now()}@example.test`,
        password: TEST_PASSWORD,
        name: 'Cookie User',
      })
      .expect(201);

    expect(response.body).not.toHaveProperty('token');
    expect(response.body).not.toHaveProperty('rawToken');
    expect(response.body).toEqual({
      id: expect.any(String),
      email: expect.any(String),
      name: 'Cookie User',
    });

    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    expect(
      cookies.some((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`)),
    ).toBe(true);
  });

  it('AUTH-04 session cookie is HttpOnly with Path=/', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `auth-flags-${Date.now()}@example.test`,
        password: TEST_PASSWORD,
        name: 'Flags User',
      })
      .expect(201);

    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const session = cookies.find((value) =>
      value.startsWith(`${SESSION_COOKIE_NAME}=`),
    );

    expect(session).toBeDefined();
    expect(session!.toLowerCase()).toContain('httponly');
    expect(session).toMatch(/path=\//i);
  });
});
