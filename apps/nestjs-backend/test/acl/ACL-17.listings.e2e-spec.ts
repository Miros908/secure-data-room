import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  type Actor,
  type TestFolder,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §2 ACL-17
 * Листинги и breadcrumbs не показывают чужие имена и id.
 */
describe('ACL-17 listings do not leak foreign rooms or breadcrumbs', () => {
  let testApp: TestApp;
  let owner: Actor;
  let stranger: Actor;
  let ownerFolder: TestFolder;

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
      name: `secret-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
  });

  it('GET /data-rooms for stranger does not include owner room', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/data-rooms')
      .set('Cookie', stranger.cookie)
      .expect(200);

    expect(response.body.myRoom.id).toBe(stranger.roomId);
    expect(response.body.myRoom.id).not.toBe(owner.roomId);
    const sharedIds = (response.body.sharedRooms as Array<{ id: string }>).map(
      (room) => room.id,
    );
    expect(sharedIds).not.toContain(owner.roomId);
    expect(JSON.stringify(response.body)).not.toContain(ownerFolder.name);
  });

  it('GET /data-rooms/me is stranger own room only', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/data-rooms/me')
      .set('Cookie', stranger.cookie)
      .expect(200);

    expect(response.body.id).toBe(stranger.roomId);
    expect(response.body.id).not.toBe(owner.roomId);
  });

  it('GET /access/outgoing does not list owner shares', async () => {
    await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: stranger.id,
        role: 'viewer',
        type: 'folder',
        id: ownerFolder.id,
      })
      .expect(201);

    const response = await request(testApp.app.getHttpServer())
      .get('/access/outgoing')
      .set('Cookie', stranger.cookie)
      .expect(200);

    const ids = (response.body.items as Array<{ id: string }>).map(
      (item) => item.id,
    );
    expect(ids).not.toContain(owner.roomId);
    expect(ids).not.toContain(ownerFolder.id);
    expect(JSON.stringify(response.body)).not.toContain(ownerFolder.name);
  });

  it('GET /access/incoming lists only grants to stranger, not owner private tree', async () => {
    const nested = await createFolder(testApp.app, owner.cookie, {
      name: `private-child-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: ownerFolder.id,
    });

    await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: stranger.id,
        role: 'viewer',
        type: 'folder',
        id: ownerFolder.id,
      })
      .expect(201);

    const incoming = await request(testApp.app.getHttpServer())
      .get('/access/incoming')
      .set('Cookie', stranger.cookie)
      .expect(200);

    const folderIds = (incoming.body.folders as Array<{ id: string }>).map(
      (item) => item.id,
    );
    expect(folderIds).toContain(ownerFolder.id);
    expect(folderIds).not.toContain(nested.id);

    const nestedListing = await request(testApp.app.getHttpServer())
      .get(`/folders/${nested.id}`)
      .set('Cookie', stranger.cookie);

    expect(nestedListing.status).toBe(200);
    const crumbIds = (
      nestedListing.body.breadcrumbs as Array<{ id: string; name: string }>
    ).map((crumb) => crumb.id);
    expect(crumbIds).toContain(ownerFolder.id);
    expect(crumbIds).not.toContain(owner.roomId);
  });

  it('denied folder GET has no breadcrumbs payload', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get(`/folders/${ownerFolder.id}`)
      .set('Cookie', stranger.cookie);

    expectHidden(response);
  });
});
