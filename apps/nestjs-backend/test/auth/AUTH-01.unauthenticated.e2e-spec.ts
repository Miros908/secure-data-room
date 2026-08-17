import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerSession } from '../helpers/auth-client';

/**
 * Чек-лист §1 AUTH-01
 * Без сессии и без share token нельзя получить listing, metadata или signed URL.
 */
describe('AUTH-01 unauthenticated API', () => {
  let testApp: TestApp;
  const unknownId = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
  });

  it.each([
    ['GET', '/events'],
    ['GET', '/auth/me'],
    ['GET', '/data-rooms'],
    ['GET', '/data-rooms/me'],
    ['GET', '/access/incoming'],
    ['GET', '/access/outgoing'],
    ['POST', '/auth/logout'],
    ['POST', '/folders'],
    ['POST', '/files'],
    ['DELETE', `/files/${unknownId}`],
    ['DELETE', `/folders/${unknownId}`],
    ['POST', '/access/grants'],
    ['GET', `/data-rooms/${unknownId}/activity`],
    ['GET', `/data-rooms/${unknownId}/activity/summary`],
  ] as const)('%s %s without cookie → 401', async (method, path) => {
    const server = testApp.app.getHttpServer();
    const call =
      method === 'GET'
        ? request(server).get(path)
        : method === 'DELETE'
          ? request(server).delete(path)
          : request(server).post(path);

    const response = await call;
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'unauthorized' });
  });

  it('GET /data-rooms/:id of an existing room without cookie → 404, no metadata', async () => {
    const session = await registerSession(testApp.app);
    const rooms = await request(testApp.app.getHttpServer())
      .get('/data-rooms')
      .set('Cookie', session.cookie)
      .expect(200);
    const roomId = rooms.body.myRoom.id as string;

    const response = await request(testApp.app.getHttpServer()).get(
      `/data-rooms/${roomId}`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'not_found' });
    expect(response.body).not.toHaveProperty('name');
    expect(response.body).not.toHaveProperty('downloadUrl');
  });

  it('GET /folders?dataRoomId= of an existing room without cookie → 404, no listing', async () => {
    const session = await registerSession(testApp.app);
    const rooms = await request(testApp.app.getHttpServer())
      .get('/data-rooms')
      .set('Cookie', session.cookie)
      .expect(200);
    const roomId = rooms.body.myRoom.id as string;

    const response = await request(testApp.app.getHttpServer()).get(
      `/folders?dataRoomId=${roomId}`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'not_found' });
    expect(response.body).not.toHaveProperty('folders');
    expect(response.body).not.toHaveProperty('files');
  });

  it('GET /files/:id without cookie → 404, no signed URL', async () => {
    const response = await request(testApp.app.getHttpServer()).get(
      `/files/${randomUUID()}`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'not_found' });
    expect(response.body).not.toHaveProperty('downloadUrl');
  });

  it('POST /files/:id/view without cookie or token → 404', async () => {
    const response = await request(testApp.app.getHttpServer()).post(
      `/files/${randomUUID()}/view`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'not_found' });
  });

  it('POST /files/:id/download without cookie or token → 404', async () => {
    const response = await request(testApp.app.getHttpServer()).post(
      `/files/${randomUUID()}/download`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'not_found' });
    expect(response.body).not.toHaveProperty('downloadUrl');
  });
});
