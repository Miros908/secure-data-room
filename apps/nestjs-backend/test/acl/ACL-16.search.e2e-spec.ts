import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { createPublicLink, grantAccess } from '../helpers/access-client';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * ACL-16: search is a backend operation, scoped by the same ACL as listing.
 */
describe('ACL-16 search respects owner, grants and public links', () => {
  let testApp: TestApp;
  let owner: Actor;
  let stranger: Actor;
  let viewer: Actor;
  const tag = randomUUID().slice(0, 8);

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
    viewer = await registerActor(testApp.app);
  });

  it('owner finds a nested file by substring; stranger gets 404', async () => {
    const legal = await createFolder(testApp.app, owner.cookie, {
      name: `Legal ${tag}`,
      dataRoomId: owner.roomId,
    });
    const nested = await createFolder(testApp.app, owner.cookie, {
      name: `2024 ${tag}`,
      dataRoomId: owner.roomId,
      parentId: legal.id,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `Term Sheet ${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: nested.id,
    });

    const found = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: tag, dataRoomId: owner.roomId })
      .set('Cookie', owner.cookie)
      .expect(200);

    const fileHit = found.body.items.find(
      (item: { kind: string; id: string }) =>
        item.kind === 'file' && item.id === file.id,
    );
    expect(fileHit).toMatchObject({
      kind: 'file',
      id: file.id,
      name: `Term Sheet ${tag}.pdf`,
      parentId: nested.id,
    });
    expect(
      fileHit.breadcrumbs.map((crumb: { name: string }) => crumb.name),
    ).toEqual([`Legal ${tag}`, `2024 ${tag}`]);

    const hidden = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: tag, dataRoomId: owner.roomId })
      .set('Cookie', stranger.cookie);
    expectHidden(hidden);
  });

  it('folder grant does not return a sibling subtree', async () => {
    const allowed = await createFolder(testApp.app, owner.cookie, {
      name: `Allowed ${tag}`,
      dataRoomId: owner.roomId,
    });
    const denied = await createFolder(testApp.app, owner.cookie, {
      name: `Denied ${tag}`,
      dataRoomId: owner.roomId,
    });
    const visible = await uploadPdf(testApp.app, owner.cookie, {
      name: `Visible ${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: allowed.id,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `Secret ${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: denied.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: allowed.id,
    });

    const response = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: tag, dataRoomId: owner.roomId })
      .set('Cookie', viewer.cookie)
      .expect(200);

    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(visible.id);
    expect(ids).toContain(allowed.id);
    expect(ids).not.toContain(denied.id);
    expect(
      response.body.items.some(
        (item: { name: string }) => item.name === `Secret ${tag}.pdf`,
      ),
    ).toBe(false);
  });

  it('file grant returns only that file and hides parent breadcrumbs', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `Hidden parent ${tag}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `Shared ${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });

    const response = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: tag, dataRoomId: owner.roomId })
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(response.body.items).toEqual([
      expect.objectContaining({
        kind: 'file',
        id: file.id,
        parentId: null,
        breadcrumbs: [],
      }),
    ]);
  });

  it('public folder token cannot search outside the shared subtree', async () => {
    const shared = await createFolder(testApp.app, owner.cookie, {
      name: `Shared ${tag}`,
      dataRoomId: owner.roomId,
    });
    const other = await createFolder(testApp.app, owner.cookie, {
      name: `Other ${tag}`,
      dataRoomId: owner.roomId,
    });
    const nested = await uploadPdf(testApp.app, owner.cookie, {
      name: `Inside ${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: shared.id,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `Outside ${tag}.pdf`,
      dataRoomId: owner.roomId,
      folderId: other.id,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'folder',
      id: shared.id,
    });

    const response = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: tag, dataRoomId: owner.roomId, token: link.token })
      .expect(200);

    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(nested.id);
    expect(ids).toContain(shared.id);
    expect(ids).not.toContain(other.id);
    expect(response.body.role).toBe('viewer');
  });

  it('percent in the query does not match every visible name', async () => {
    const percent = await uploadPdf(testApp.app, owner.cookie, {
      name: `100% ${tag}.pdf`,
      dataRoomId: owner.roomId,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `plain ${tag}.pdf`,
      dataRoomId: owner.roomId,
    });

    const response = await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: '%', dataRoomId: owner.roomId })
      .set('Cookie', owner.cookie)
      .expect(200);

    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(percent.id);
    expect(ids).toHaveLength(1);
  });

  it('empty query is 400; unknown extra fields are 400', async () => {
    await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: '   ', dataRoomId: owner.roomId })
      .set('Cookie', owner.cookie)
      .expect(400);

    await request(testApp.app.getHttpServer())
      .get('/search')
      .query({ q: 'nda', dataRoomId: owner.roomId, ownerId: owner.id })
      .set('Cookie', owner.cookie)
      .expect(400);
  });
});
