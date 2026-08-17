import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { MAX_ACCESS_TTL_MS } from '../../src/modules/access/access.constants';
import { createPublicLink, grantAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

describe('timed access expiry', () => {
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
  });

  it('rejects a public link expiresAt in the past', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    const response = await request(testApp.app.getHttpServer())
      .post('/access/public-links')
      .set('Cookie', owner.cookie)
      .send({
        type: 'file',
        id: file.id,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_expires_at');
  });

  it('rejects an expiresAt further than one year', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    const response = await request(testApp.app.getHttpServer())
      .post('/access/public-links')
      .set('Cookie', owner.cookie)
      .send({
        type: 'file',
        id: file.id,
        expiresAt: new Date(
          Date.now() + MAX_ACCESS_TTL_MS + 60_000,
        ).toISOString(),
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_expires_at');
  });

  it('hides an expired public link the same as a missing one', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await request(testApp.app.getHttpServer())
      .get('/access/public-links/resolve')
      .query({ token: link.token })
      .expect(200);

    await testApp.prisma.public_share_links.update({
      where: { id: link.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get('/access/public-links/resolve')
        .query({ token: link.token }),
    );
    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/files/${file.id}?token=${link.token}`,
      ),
    );
  });

  it('hides listing after a grant expires and allows re-grant', async () => {
    viewer = await registerActor(testApp.app);
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const grant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await request(testApp.app.getHttpServer())
      .get(`/folders/${folder.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    await testApp.prisma.access_grants.update({
      where: { id: grant.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/folders/${folder.id}`)
        .set('Cookie', viewer.cookie),
    );

    const again = await request(testApp.app.getHttpServer())
      .post('/access/grants')
      .set('Cookie', owner.cookie)
      .send({
        userId: viewer.id,
        role: 'viewer',
        type: 'folder',
        id: folder.id,
      });

    expect(again.status).toBe(201);
    expect(again.body.id).toBe(grant.id);
    expect(again.body.expiresAt).toBeNull();
  });

  it('SHARE-12 unlimited covering grant hides the timer on a timed child', async () => {
    viewer = await registerActor(testApp.app);
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
    });

    const listing = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(listing.body.accessExpiresAt).toBeNull();
  });

  it('caps a new signed URL to the remaining access window', async () => {
    viewer = await registerActor(testApp.app);
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
    });

    const before = Date.now();
    const response = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    const downloadExpires = Date.parse(response.body.downloadUrlExpiresAt);
    expect(downloadExpires).toBeGreaterThan(before);
    expect(downloadExpires).toBeLessThanOrEqual(before + 2 * 60 * 1000 + 2000);
  });

  it('shortens the invite accept deadline to the access window', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `exp-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const accessExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const response = await request(testApp.app.getHttpServer())
      .post('/access/invitations')
      .set('Cookie', owner.cookie)
      .send({
        email: `new-${randomUUID()}@example.test`,
        role: 'viewer',
        type: 'folder',
        id: folder.id,
        expiresAt: accessExpiresAt,
      })
      .expect(201);

    expect(Date.parse(response.body.expiresAt)).toBeLessThanOrEqual(
      Date.parse(accessExpiresAt),
    );
    expect(response.body.accessExpiresAt).toBe(accessExpiresAt);
  });
});
