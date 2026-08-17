import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §3 SHARE-09
 * Приватные ответы не кешируются как public.
 */
describe('SHARE-09 private responses are not cacheable as public', () => {
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
    owner = await registerActor(testApp.app);
  });

  it.each([
    ['GET', '/auth/me'],
    ['GET', '/data-rooms'],
  ] as const)(
    '%s %s sends private/no-store Cache-Control',
    async (method, path) => {
      const response = await request(testApp.app.getHttpServer())
        [method.toLowerCase() as 'get'](path)
        .set('Cookie', owner.cookie)
        .expect(200);

      expectPrivateCache(response.headers['cache-control']);
    },
  );

  it('GET /data-rooms/:id, folder and file send private/no-store Cache-Control', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `cache-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `cache-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    const server = testApp.app.getHttpServer();

    const room = await request(server)
      .get(`/data-rooms/${owner.roomId}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const listing = await request(server)
      .get(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const detail = await request(server)
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expectPrivateCache(room.headers['cache-control']);
    expectPrivateCache(listing.headers['cache-control']);
    expectPrivateCache(detail.headers['cache-control']);
  });
});

function expectPrivateCache(header: string | string[] | undefined): void {
  const value = Array.isArray(header) ? header.join(',') : (header ?? '');
  expect(value.toLowerCase()).toMatch(/no-store|private/);
  expect(value.toLowerCase()).not.toMatch(/public/);
}
