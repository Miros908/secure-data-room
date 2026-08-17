import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerSession, TEST_PASSWORD } from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-12
 * Login не отличает «нет пользователя» от «неверный пароль» по коду ответа.
 */
describe('AUTH-12 auth responses do not enumerate emails', () => {
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

  it('unknown email and wrong password both return 401 unauthorized', async () => {
    const session = await registerSession(testApp.app);
    const server = testApp.app.getHttpServer();

    const unknown = await request(server)
      .post('/auth/login')
      .send({
        email: `missing-${randomUUID()}@example.test`,
        password: TEST_PASSWORD,
      });
    const wrong = await request(server).post('/auth/login').send({
      email: session.email,
      password: 'WrongPass-12',
    });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.code).toBe('unauthorized');
    expect(wrong.body.code).toBe(unknown.body.code);
  });

  it('registering an existing email does not return email_taken', async () => {
    const session = await registerSession(testApp.app);

    const taken = await request(testApp.app.getHttpServer())
      .post('/auth/register')
      .send({
        email: session.email,
        password: TEST_PASSWORD,
        name: 'Other',
      });

    expect(taken.status).not.toBe(409);
    expect(taken.body.code).not.toBe('email_taken');
  });

  it('invite to a registered email and an unknown email look the same', async () => {
    const owner = await registerSession(testApp.app);
    const existing = await registerSession(testApp.app);
    const rooms = await request(testApp.app.getHttpServer())
      .get('/data-rooms')
      .set('Cookie', owner.cookie)
      .expect(200);
    const roomId = rooms.body.myRoom.id as string;
    const payload = {
      role: 'viewer',
      type: 'data_room',
      id: roomId,
    };

    const known = await request(testApp.app.getHttpServer())
      .post('/access/invitations')
      .set('Cookie', owner.cookie)
      .send({ ...payload, email: existing.email });
    const unknown = await request(testApp.app.getHttpServer())
      .post('/access/invitations')
      .set('Cookie', owner.cookie)
      .send({
        ...payload,
        email: `nobody-${randomUUID()}@example.test`,
      });

    expect(known.status).toBe(unknown.status);
    expect(known.body.code ?? null).toBe(unknown.body.code ?? null);
  });

  it('share-by-email does not reveal whether the address already has an account', async () => {
    const owner = await registerSession(testApp.app);
    const existing = await registerSession(testApp.app);
    const rooms = await request(testApp.app.getHttpServer())
      .get('/data-rooms')
      .set('Cookie', owner.cookie)
      .expect(200);
    const roomId = rooms.body.myRoom.id as string;
    const payload = {
      role: 'viewer',
      type: 'data_room',
      id: roomId,
    };

    const known = await request(testApp.app.getHttpServer())
      .post('/access/people')
      .set('Cookie', owner.cookie)
      .send({ ...payload, email: existing.email });
    const unknown = await request(testApp.app.getHttpServer())
      .post('/access/people')
      .set('Cookie', owner.cookie)
      .send({
        ...payload,
        email: `nobody-${randomUUID()}@example.test`,
      });

    expect(known.status).toBe(unknown.status);
    expect(known.body.kind ?? null).toBe(unknown.body.kind ?? null);
  });
});
