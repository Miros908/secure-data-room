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
 * Чек-лист §2 ACL-08, ACL-15
 * B не создаёт и не отзывает share A.
 */
describe('ACL-08 stranger cannot share or revoke owner resources', () => {
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

  it.each([
    ['data_room', () => owner.roomId],
    ['folder', () => folder.id],
    ['file', () => file.id],
  ] as const)('POST /access/grants on owner %s → 404', async (type, id) => {
    const response = await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', stranger.cookie)
      .send({
        userId: stranger.id,
        role: 'viewer',
        type,
        id: id(),
      });

    expectHidden(response);
  });

  it('POST /access/people on owner room → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/access/people')
      .set('Cookie', stranger.cookie)
      .send({
        email: `other-${randomUUID()}@example.test`,
        role: 'viewer',
        type: 'data_room',
        id: owner.roomId,
      });

    expectHidden(response);
  });

  it('POST /access/invitations on owner room → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/access/invitations')
      .set('Cookie', stranger.cookie)
      .send({
        email: `other-${randomUUID()}@example.test`,
        role: 'viewer',
        type: 'data_room',
        id: owner.roomId,
      });

    expectHidden(response);
  });

  it('POST /access/public-links on owner room → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/access/public-links')
      .set('Cookie', stranger.cookie)
      .send({ type: 'data_room', id: owner.roomId });

    expectHidden(response);
  });

  it('GET /access/shares of owner room → 404', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/access/shares?type=data_room&id=${owner.roomId}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);
  });

  it('POST /access/revoke of a grant on owner room without access → 404', async () => {
    const third = await registerActor(testApp.app);
    const grant = await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: third.id,
        role: 'viewer',
        type: 'data_room',
        id: owner.roomId,
      })
      .expect(201);

    const response = await request(testApp.app.getHttpServer())
      .post('/access/revoke')
      .set('Cookie', stranger.cookie)
      .send({ kind: 'grant', id: grant.body.id });

    expectHidden(response);

    await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}`)
      .set('Cookie', third.cookie)
      .expect(200);
  });

  it('viewer cannot revoke owner grant', async () => {
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

    const response = await request(testApp.app.getHttpServer())
      .post('/access/revoke')
      .set('Cookie', stranger.cookie)
      .send({ kind: 'grant', id: grant.body.id });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('forbidden');

    await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}`)
      .set('Cookie', stranger.cookie)
      .expect(200);
  });

  it('POST /access/revoke of owner public link → 404', async () => {
    const link = await request(testApp.app.getHttpServer())
      .post('/access/public-links')
      .set('Cookie', owner.cookie)
      .send({ type: 'folder', id: folder.id })
      .expect(201);

    const response = await request(testApp.app.getHttpServer())
      .post('/access/revoke')
      .set('Cookie', stranger.cookie)
      .send({ kind: 'public_link', id: link.body.id });

    expectHidden(response);
  });
});
