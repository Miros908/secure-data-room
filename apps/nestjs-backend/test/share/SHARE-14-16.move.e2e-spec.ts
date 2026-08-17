import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { grantAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §3 SHARE-14, SHARE-15, SHARE-16
 * Move файла снимает/даёт inherited доступ; прямой grant на файл переживает move.
 */
describe('SHARE-14–16 move vs inherited and direct file grants', () => {
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

  it('SHARE-14 file moved out of a shared folder loses inherited access', async () => {
    const shared = await createFolder(testApp.app, owner.cookie, {
      name: `shared-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const privateFolder = await createFolder(testApp.app, owner.cookie, {
      name: `private-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `moved-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: shared.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: shared.id,
    });

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/move`)
      .set('Cookie', owner.cookie)
      .send({ folderId: privateFolder.id })
      .expect(201);

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/files/${file.id}`)
        .set('Cookie', viewer.cookie),
    );
  });

  it('SHARE-15 file moved into a shared folder gains inherited access', async () => {
    const shared = await createFolder(testApp.app, owner.cookie, {
      name: `shared-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `moved-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: shared.id,
    });

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/files/${file.id}`)
        .set('Cookie', viewer.cookie),
    );

    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/move`)
      .set('Cookie', owner.cookie)
      .send({ folderId: shared.id })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);
  });

  it('SHARE-16 direct file grant survives move to another folder', async () => {
    const source = await createFolder(testApp.app, owner.cookie, {
      name: `source-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const dest = await createFolder(testApp.app, owner.cookie, {
      name: `dest-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `direct-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: source.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });

    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/move`)
      .set('Cookie', owner.cookie)
      .send({ folderId: dest.id })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/folders/${dest.id}`)
        .set('Cookie', viewer.cookie),
    );
  });
});
