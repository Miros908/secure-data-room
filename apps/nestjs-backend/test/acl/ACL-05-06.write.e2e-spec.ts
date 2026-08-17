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
 * Чек-лист §2 ACL-05, ACL-06, ACL-15
 * B не мутирует файлы/папки A и не создаёт узлы в комнате A.
 */
describe('ACL-05–06 stranger cannot write into owner room', () => {
  let testApp: TestApp;
  let owner: Actor;
  let stranger: Actor;
  let folder: TestFolder;
  let nested: TestFolder;
  let file: TestFile;

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
    folder = await createFolder(testApp.app, owner.cookie, {
      name: `acl-folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    nested = await createFolder(testApp.app, owner.cookie, {
      name: `acl-nested-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: folder.id,
    });
    file = await uploadPdf(testApp.app, owner.cookie, {
      name: `acl-file-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
  });

  it('ACL-05 PATCH /files/:id rename → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .patch(`/files/${file.id}`)
      .set('Cookie', stranger.cookie)
      .send({ name: 'stolen.pdf' });

    expectHidden(response);
  });

  it('ACL-05 POST /files/:id/move → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/move`)
      .set('Cookie', stranger.cookie)
      .send({ folderId: nested.id });

    expectHidden(response);
  });

  it('ACL-05 DELETE /files/:id → 404, file still there for owner', async () => {
    const response = await request(testApp.app.getHttpServer())
      .delete(`/files/${file.id}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
  });

  it('ACL-05 PATCH /folders/:id rename → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .patch(`/folders/${folder.id}`)
      .set('Cookie', stranger.cookie)
      .send({ name: 'stolen' });

    expectHidden(response);
  });

  it('ACL-05 DELETE /folders/:id → 404, folder still there for owner', async () => {
    const response = await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);

    await request(testApp.app.getHttpServer())
      .get(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
  });

  it('ACL-06 POST /folders into owner room → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', stranger.cookie)
      .send({
        name: `intruder-${randomUUID()}`,
        dataRoomId: owner.roomId,
      });

    expectHidden(response);
  });

  it('ACL-06 POST /folders under owner folder → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', stranger.cookie)
      .send({
        name: `intruder-${randomUUID()}`,
        parentId: folder.id,
      });

    expectHidden(response);
  });

  it('ACL-06 POST /files into owner room → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', stranger.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', `intruder-${randomUUID()}.pdf`)
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), {
        filename: 'intruder.pdf',
        contentType: 'application/pdf',
      });

    expectHidden(response);
  });

  it('ACL-06 POST /files into owner folder → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', stranger.cookie)
      .field('dataRoomId', owner.roomId)
      .field('folderId', folder.id)
      .field('name', `intruder-${randomUUID()}.pdf`)
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF\n'), {
        filename: 'intruder.pdf',
        contentType: 'application/pdf',
      });

    expectHidden(response);
  });
});
