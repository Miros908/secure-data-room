import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '@sdr/shared/http';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  registerActor,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §8 API-01, 03, 06–08, 15, 16, 18, 19
 */
describe('API-01 / 03 / 06–08 / 15 / 16 / 18 / 19 contract', () => {
  let testApp: TestApp;
  let owner: Actor;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    testApp.logs.length = 0;
    owner = await registerActor(testApp.app);
  });

  it('API-01 unknown JSON fields are rejected', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({
        name: `extra-${randomUUID()}`,
        dataRoomId: owner.roomId,
        ownerId: randomUUID(),
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
  });

  it('API-03 folder name longer than 255 is rejected', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({
        name: 'n'.repeat(256),
        dataRoomId: owner.roomId,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
  });

  it('API-06 error JSON has no stack, SQL or Nest pipe text', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/files/not-a-uuid')
      .set('Cookie', owner.cookie);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      code: 'bad_request',
      requestId: expect.any(String),
    });
    const dumped = JSON.stringify(response.body);
    expect(dumped).not.toMatch(/stack|prisma|SELECT |uuid v4/i);
  });

  it('API-07 / API-08 name conflict is 409 name_taken', async () => {
    const name = `dup-${randomUUID()}`;
    await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({ name, dataRoomId: owner.roomId })
      .expect(201);

    const again = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({ name, dataRoomId: owner.roomId });

    expect(again.status).toBe(409);
    expect(again.body.code).toBe('name_taken');
  });

  it('API-08 missing node is 404 not_found, not 410', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/folders/${randomUUID()}`)
      .set('Cookie', owner.cookie);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('not_found');
  });

  it('API-15 failed signed GET does not log the signature', async () => {
    const marker = `sigsecret${randomUUID().replaceAll('-', '')}`;
    await request(testApp.app.getHttpServer()).get(
      `/storage/objects?key=a/b.pdf&sig=${marker}&expires=1`,
    );

    expect(testApp.logs.join('\n')).not.toContain(marker);
  });

  it('API-16 / AUTH-15 /health is 404 without secrets', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/health');
    expect(response.status).toBe(404);
    const body = JSON.stringify(response.body).toLowerCase();
    expect(body).not.toContain('postgres://');
    expect(body).not.toContain(String(process.env.DATABASE_URL).toLowerCase());
  });

  it('API-18 echoes a safe x-request-id on errors', async () => {
    const requestId = `req-${randomUUID()}`;
    const response = await request(testApp.app.getHttpServer())
      .get('/auth/me')
      .set(REQUEST_ID_HEADER, requestId);

    expect(response.status).toBe(401);
    expect(response.headers[REQUEST_ID_HEADER]).toBe(requestId);
    expect(response.body.requestId).toBe(requestId);
  });

  it('API-19 remote file URL is not an upload field', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', `url-${randomUUID()}.pdf`)
      .field('sourceUrl', 'http://127.0.0.1/secret.pdf')
      .attach('file', MINIMAL_PDF, {
        filename: 'url.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
  });
});
