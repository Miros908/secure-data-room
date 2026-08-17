import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createPublicLink, grantAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §3 SHARE-20
 * Удаление target сразу закрывает его public link и grants.
 */
describe('SHARE-20 deleting the target invalidates shares', () => {
  let testApp: TestApp;
  let owner: Actor;
  let viewer: Actor;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    viewer = await registerActor(testApp.app);
  });

  it('deleting a folder invalidates its public link and grant', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `gone-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `gone-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'folder',
      id: folder.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const resolved = await request(testApp.app.getHttpServer()).get(
      `/access/public-links/resolve?token=${link.token}`,
    );
    expect(resolved.status).toBe(404);

    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/folders/${folder.id}?token=${link.token}`,
      ),
    );
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/files/${file.id}`)
        .set('Cookie', viewer.cookie),
    );
  });

  it('deleting a file invalidates its public link', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `gone-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/files/${file.id}?token=${link.token}`,
      ),
    );
    const resolved = await request(testApp.app.getHttpServer()).get(
      `/access/public-links/resolve?token=${link.token}`,
    );
    expect(resolved.status).toBe(404);
  });
});
