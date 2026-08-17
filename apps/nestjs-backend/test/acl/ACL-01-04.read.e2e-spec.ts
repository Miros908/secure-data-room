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
 * Чек-лист §2 ACL-01…04, ACL-12, ACL-15, ACL-18
 * Посторонний B не читает комнату/папку/файл A и не получает signed URL.
 * Запросы идут в Nest, не в Next middleware.
 */
describe('ACL-01–04 stranger cannot read owner resources', () => {
  let testApp: TestApp;
  let owner: Actor;
  let stranger: Actor;
  let folder: TestFolder;
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
    file = await uploadPdf(testApp.app, owner.cookie, {
      name: `acl-file-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
  });

  it('ACL-01 GET /data-rooms/:id of owner room → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);
  });

  it('ACL-02 GET /folders?dataRoomId= of owner room → 404, no listing', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/folders?dataRoomId=${owner.roomId}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);
  });

  it('ACL-02 GET /folders/:id of owner folder → 404, no listing', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/folders/${folder.id}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);
  });

  it('ACL-03 GET /files/:id of owner file → 404, no metadata', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);
  });

  it('ACL-04 / ACL-18 GET /files/:id does not return downloadUrl to stranger', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);
    expect(JSON.stringify(response.body)).not.toContain('http');
  });

  it('owner can still read the same resources', async () => {
    const server = testApp.app.getHttpServer();

    await request(server)
      .get(`/data-rooms/${owner.roomId}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    await request(server)
      .get(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const fileResponse = await request(server)
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(fileResponse.body.downloadUrl).toEqual(expect.any(String));
  });
});
