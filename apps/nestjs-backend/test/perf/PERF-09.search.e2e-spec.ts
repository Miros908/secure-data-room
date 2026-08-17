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
 * PERF-09: search is keyset-paginated and is not folder listing.
 */
describe('PERF-09 search pagination', () => {
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

  it('pages by cursor without OFFSET and finds a nested file listing would miss', async () => {
    const tag = randomUUID().slice(0, 8);
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `Nested ${tag}`,
      dataRoomId: owner.roomId,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `a-${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `b-${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `c-${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });

    const listing = await request(testApp.app.getHttpServer())
      .get('/folders')
      .query({ dataRoomId: owner.roomId })
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(listing.body.files).toEqual([]);

    const first = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: tag, dataRoomId: owner.roomId, limit: 2 })
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({
        q: tag,
        dataRoomId: owner.roomId,
        limit: 2,
        cursor: first.body.nextCursor,
      })
      .set('Cookie', owner.cookie)
      .expect(200);

    const ids = [...first.body.items, ...second.body.items].map(
      (item: { id: string }) => item.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});
