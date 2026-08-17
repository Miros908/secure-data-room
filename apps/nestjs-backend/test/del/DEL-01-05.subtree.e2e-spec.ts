import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { StorageNotFoundError } from '../../src/infrastructure/storage/storage.errors';
import type { StorageService } from '../../src/infrastructure/storage/storage.service';
import { STORAGE_SERVICE } from '../../src/infrastructure/storage/storage.tokens';
import { createPublicLink, grantAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §7 DEL-01, 03–05: счётчики, недоступность поддерева, shares, объекты.
 */
describe('DEL-01 / 03–05 folder subtree delete', () => {
  let testApp: TestApp;
  let owner: Actor;
  let viewer: Actor;
  let storage: StorageService;

  beforeAll(async () => {
    testApp = await createTestApp();
    storage = testApp.app.get(STORAGE_SERVICE);
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    viewer = await registerActor(testApp.app);
  });

  it('DEL-01 response counts the folder, nested folder and both files', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const child = await createFolder(testApp.app, owner.cookie, {
      name: `child-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `in-parent-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: parent.id,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `in-child-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: child.id,
    });

    const response = await request(testApp.app.getHttpServer())
      .delete(`/folders/${parent.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      deletedFolders: 2,
      deletedFiles: 2,
    });
  });

  it('DEL-03 / DEL-04 listing and direct GET of descendants are 404 after commit', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const child = await createFolder(testApp.app, owner.cookie, {
      name: `child-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    const nested = await uploadPdf(testApp.app, owner.cookie, {
      name: `nested-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: child.id,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${parent.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/folders/${parent.id}`)
        .set('Cookie', owner.cookie),
    );
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/folders/${child.id}`)
        .set('Cookie', owner.cookie),
    );
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/files/${nested.id}`)
        .set('Cookie', owner.cookie),
    );

    const listing = await request(testApp.app.getHttpServer())
      .get(`/folders?dataRoomId=${owner.roomId}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(
      listing.body.folders.map((folder: { id: string }) => folder.id),
    ).not.toContain(parent.id);
    expect(
      listing.body.files.map((file: { id: string }) => file.id),
    ).not.toContain(nested.id);
  });

  it('DEL-05 shares on the deleted tree stop working', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `shared-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `shared-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'folder',
      id: folder.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(
      (
        await request(testApp.app.getHttpServer()).get(
          `/access/public-links/resolve?token=${link.token}`,
        )
      ).status,
    ).toBe(404);
    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/folders/${folder.id}?token=${link.token}`,
      ),
    );
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/files/${file.id}`)
        .set('Cookie', viewer.cookie),
    );
  });

  it('deleting a folder removes nested objects from storage', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `store-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const nested = await createFolder(testApp.app, owner.cookie, {
      name: `inner-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: folder.id,
    });
    const top = await uploadPdf(testApp.app, owner.cookie, {
      name: `top-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    const deep = await uploadPdf(testApp.app, owner.cookie, {
      name: `deep-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: nested.id,
    });
    const topKey = (
      await testApp.prisma.file_versions.findFirstOrThrow({
        where: { file_id: top.id },
      })
    ).storage_key;
    const deepKey = (
      await testApp.prisma.file_versions.findFirstOrThrow({
        where: { file_id: deep.id },
      })
    ).storage_key;

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    await expect(storage.get(topKey)).rejects.toBeInstanceOf(
      StorageNotFoundError,
    );
    await expect(storage.get(deepKey)).rejects.toBeInstanceOf(
      StorageNotFoundError,
    );
  });
});
