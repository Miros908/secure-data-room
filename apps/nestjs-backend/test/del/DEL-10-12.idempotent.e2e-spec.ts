import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { StorageNotFoundError } from '../../src/infrastructure/storage/storage.errors';
import type { StorageService } from '../../src/infrastructure/storage/storage.service';
import { STORAGE_SERVICE } from '../../src/infrastructure/storage/storage.tokens';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §7 DEL-10…12 идемпотентность и параллельный delete.
 */
describe('DEL-10–12 idempotent and parallel delete', () => {
  let testApp: TestApp;
  let owner: Actor;
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
  });

  it('DEL-10 file delete succeeds if the object is already gone', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `gone-obj-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const key = (
      await testApp.prisma.file_versions.findFirstOrThrow({
        where: { file_id: file.id },
      })
    ).storage_key;
    await storage.delete(key);
    await expect(storage.get(key)).rejects.toBeInstanceOf(StorageNotFoundError);

    await request(testApp.app.getHttpServer())
      .delete(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
  });

  it('DEL-11 a second DELETE is 404 and does not 500', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `once-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `once-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expectHidden(
      await request(testApp.app.getHttpServer())
        .delete(`/folders/${folder.id}`)
        .set('Cookie', owner.cookie),
    );

    await request(testApp.app.getHttpServer())
      .delete(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expectHidden(
      await request(testApp.app.getHttpServer())
        .delete(`/files/${file.id}`)
        .set('Cookie', owner.cookie),
    );
  });

  it('DEL-12 parallel delete of parent and child does not 500', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `p-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const child = await createFolder(testApp.app, owner.cookie, {
      name: `c-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `f-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: child.id,
    });

    const [parentRes, childRes] = await Promise.all([
      request(testApp.app.getHttpServer())
        .delete(`/folders/${parent.id}`)
        .set('Cookie', owner.cookie),
      request(testApp.app.getHttpServer())
        .delete(`/folders/${child.id}`)
        .set('Cookie', owner.cookie),
    ]);

    expect([parentRes.status, childRes.status]).not.toContain(500);
    expect([200, 404]).toContain(parentRes.status);
    expect([200, 404]).toContain(childRes.status);
    expect(
      await testApp.prisma.folders.findUnique({ where: { id: parent.id } }),
    ).toBeNull();
    expect(
      await testApp.prisma.folders.findUnique({ where: { id: child.id } }),
    ).toBeNull();
    expect(
      await testApp.prisma.files.findUnique({ where: { id: file.id } }),
    ).toBeNull();
  });
});
