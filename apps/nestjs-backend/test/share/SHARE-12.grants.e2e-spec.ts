import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { grantAccess, revokeAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §3 SHARE-12
 * Несколько grants объединяются. Revoke одного не снимает доступ, пока жив другой.
 * Узкий грант после широкого не создаётся — already_covered.
 */
describe('SHARE-12 overlapping grants', () => {
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

  it('revoking a folder grant keeps access via a direct file grant', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `file-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
    const folderGrant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
    });

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'grant',
      id: folderGrant.id,
    });

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/folders/${folder.id}`)
        .set('Cookie', viewer.cookie),
    );
  });

  it('revoking a room grant keeps access via a remaining folder grant', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
    });
    const roomGrant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'data_room',
      id: owner.roomId,
    });

    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'grant',
      id: roomGrant.id,
    });

    await request(testApp.app.getHttpServer())
      .get(`/folders/${folder.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);
  });

  it('rejects a file grant already covered by a folder grant', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `file-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
    });

    const covered = await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: viewer.id,
        role: 'viewer',
        type: 'file',
        id: file.id,
      });

    expect(covered.status).toBe(409);
    expect(covered.body.code).toBe('already_covered');
  });

  it('rejects an invite already covered by a parent invite', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `file-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    const email = `pending-${randomUUID()}@example.test`;

    await request(testApp.app.getHttpServer())
      .post('/access/invitations')
      .set('Cookie', owner.cookie)
      .send({
        email,
        role: 'viewer',
        type: 'folder',
        id: folder.id,
      })
      .expect(201);

    const covered = await request(testApp.app.getHttpServer())
      .post('/access/invitations')
      .set('Cookie', owner.cookie)
      .send({
        email,
        role: 'viewer',
        type: 'file',
        id: file.id,
      });

    expect(covered.status).toBe(409);
    expect(covered.body.code).toBe('already_covered');
  });

  it('allows a file grant after the covering folder grant is revoked', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `file-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    const folderGrant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
    });

    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'grant',
      id: folderGrant.id,
    });

    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
  });
});
