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

/**
 * Чек-лист §3 SHARE-17, SHARE-18
 * Role — enum. Public link id/token нельзя перебрать как счётчик.
 */
describe('SHARE-17 role enum and SHARE-18 public link identifiers', () => {
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

  it('SHARE-17 grant role is stored as VIEWER/EDITOR enum, not booleans', async () => {
    const rejected = await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: viewer.id,
        canRead: true,
        canWrite: false,
        type: 'data_room',
        id: owner.roomId,
      });
    expect(rejected.status).toBe(400);

    const grant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'data_room',
      id: owner.roomId,
    });
    const row = await testApp.prisma.access_grants.findUniqueOrThrow({
      where: { id: grant.id },
    });
    expect(row.role).toBe('VIEWER');
  });

  it('SHARE-18 public link ids are UUIDs and sequential tokens do not resolve', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `enum-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const first = await createPublicLink(testApp.app, owner.cookie, {
      type: 'folder',
      id: folder.id,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `enum-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const second = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(first.id).not.toBe(second.id);

    const sequential = await request(testApp.app.getHttpServer()).get(
      '/access/public-links/resolve?token=1',
    );
    expect(sequential.status).toBe(404);

    const byId = await request(testApp.app.getHttpServer()).get(
      `/access/public-links/${first.id}`,
    );
    expect(byId.status).toBe(404);
  });
});
