import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
  type TestFile,
  type TestFolder,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §2 ACL-13, ACL-15, ACL-20
 * Потомок удалённой папки недоступен. Отозванный grant не оставляет доступ.
 */
describe('ACL-13 / ACL-20 deleted folder and revoked grant', () => {
  let testApp: TestApp;
  let owner: Actor;
  let stranger: Actor;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    stranger = await registerActor(testApp.app);
  });

  it('ACL-13 GET of nested folder and file after parent delete → 404', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const child: TestFolder = await createFolder(testApp.app, owner.cookie, {
      name: `child-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    const file: TestFile = await uploadPdf(testApp.app, owner.cookie, {
      name: `nested-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: child.id,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${parent.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const folderResponse = await request(testApp.app.getHttpServer())
      .get(`/folders/${child.id}`)
      .set('Cookie', owner.cookie);
    const fileResponse = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie);

    expectHidden(folderResponse);
    expectHidden(fileResponse);
  });

  it('ACL-20 revoked grant no longer opens the room', async () => {
    const grant = await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: stranger.id,
        role: 'viewer',
        type: 'data_room',
        id: owner.roomId,
      })
      .expect(201);

    await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}`)
      .set('Cookie', stranger.cookie)
      .expect(200);

    await request(testApp.app.getHttpServer())
      .post('/access/revoke')
      .set('Cookie', owner.cookie)
      .send({ kind: 'grant', id: grant.body.id })
      .expect(200);

    const room = await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}`)
      .set('Cookie', stranger.cookie);
    const folders = await request(testApp.app.getHttpServer())
      .get(`/folders?dataRoomId=${owner.roomId}`)
      .set('Cookie', stranger.cookie);

    expectHidden(room);
    expectHidden(folders);
  });
});
