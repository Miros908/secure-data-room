import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  MINIMAL_PDF,
  registerActor,
  uploadPdf,
  type Actor,
  type TestFile,
  type TestFolder,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §2 ACL-09, ACL-10, ACL-11
 * Свой fileId + чужой folderId; смешанные dataRoomId/parentId; лишние privileged поля.
 */
describe('ACL-09–11 cross-room ids and client-supplied ownership', () => {
  let testApp: TestApp;
  let owner: Actor;
  let stranger: Actor;
  let ownerFolder: TestFolder;
  let strangerFolder: TestFolder;
  let strangerFile: TestFile;

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
    ownerFolder = await createFolder(testApp.app, owner.cookie, {
      name: `owner-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    strangerFolder = await createFolder(testApp.app, stranger.cookie, {
      name: `stranger-${randomUUID()}`,
      dataRoomId: stranger.roomId,
    });
    strangerFile = await uploadPdf(testApp.app, stranger.cookie, {
      name: `stranger-${randomUUID()}.pdf`,
      dataRoomId: stranger.roomId,
    });
  });

  it('ACL-09 move own file into owner folder → 404, file stays in own room', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post(`/files/${strangerFile.id}/move`)
      .set('Cookie', stranger.cookie)
      .send({ folderId: ownerFolder.id });

    expectHidden(response);

    const stillMine = await request(testApp.app.getHttpServer())
      .get(`/files/${strangerFile.id}`)
      .set('Cookie', stranger.cookie)
      .expect(200);

    expect(stillMine.body.dataRoomId).toBe(stranger.roomId);
    expect(stillMine.body.folderId).toBeNull();
  });

  it('ACL-10 create folder with own parent and owner dataRoomId → not created', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', stranger.cookie)
      .send({
        name: `mixed-${randomUUID()}`,
        dataRoomId: owner.roomId,
        parentId: strangerFolder.id,
      });

    expect([400, 404]).toContain(response.status);
    expect(response.body).not.toHaveProperty('id');
  });

  it('ACL-10 create folder with owner parent and own dataRoomId → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', stranger.cookie)
      .send({
        name: `mixed-${randomUUID()}`,
        dataRoomId: stranger.roomId,
        parentId: ownerFolder.id,
      });

    expectHidden(response);
  });

  it('ACL-10 upload with own folderId and owner dataRoomId → not created', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', stranger.cookie)
      .field('dataRoomId', owner.roomId)
      .field('folderId', strangerFolder.id)
      .field('name', `mixed-${randomUUID()}.pdf`)
      .attach('file', MINIMAL_PDF, {
        filename: 'mixed.pdf',
        contentType: 'application/pdf',
      });

    expect([400, 404]).toContain(response.status);
    expect(response.body).not.toHaveProperty('id');
  });

  it('ACL-11 POST /folders rejects ownerId, createdById, status, role, objectKey', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', stranger.cookie)
      .send({
        name: `extra-${randomUUID()}`,
        dataRoomId: stranger.roomId,
        ownerId: owner.id,
        createdById: owner.id,
        status: 'ACTIVE',
        role: 'owner',
        objectKey: 'stolen/key',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
  });

  it('ACL-11 POST /files rejects ownerId and objectKey fields', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', stranger.cookie)
      .field('dataRoomId', stranger.roomId)
      .field('name', `extra-${randomUUID()}.pdf`)
      .field('ownerId', owner.id)
      .field('createdById', owner.id)
      .field('objectKey', 'stolen/key')
      .field('role', 'owner')
      .attach('file', MINIMAL_PDF, {
        filename: 'extra.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
  });

  it('ACL-11 POST /access/grants rejects ownerId and objectKey', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: stranger.id,
        role: 'viewer',
        type: 'data_room',
        id: owner.roomId,
        ownerId: stranger.id,
        objectKey: 'stolen/key',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('validation_error');
  });
});
