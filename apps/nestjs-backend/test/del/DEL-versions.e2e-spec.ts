import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { StorageNotFoundError } from '../../src/infrastructure/storage/storage.errors';
import type { StorageService } from '../../src/infrastructure/storage/storage.service';
import { STORAGE_SERVICE } from '../../src/infrastructure/storage/storage.tokens';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

const SECOND_PDF = Buffer.from('%PDF-1.4\n%del-v2\n%%EOF\n');

describe('delete removes every file version object', () => {
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

  it('delete file removes both version blobs; name can be reused as v1', async () => {
    const name = `gone-${randomUUID()}.pdf`;
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', SECOND_PDF, {
        filename: name,
        contentType: 'application/pdf',
      })
      .expect(200);
    const keys = (
      await testApp.prisma.file_versions.findMany({
        where: { file_id: file.id },
      })
    ).map((row) => row.storage_key);
    expect(keys).toHaveLength(2);

    await request(testApp.app.getHttpServer())
      .delete(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    for (const key of keys) {
      await expect(storage.get(key)).rejects.toBeInstanceOf(
        StorageNotFoundError,
      );
    }

    const reused = await uploadPdf(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    expect(reused.id).not.toBe(file.id);
    expect(reused.name).toBe(name);
    const versions = await testApp.prisma.file_versions.findMany({
      where: { file_id: reused.id },
    });
    expect(versions).toHaveLength(1);
    expect(versions[0].version_number).toBe(1);
  });

  it('delete folder removes every version object in the subtree', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `tree-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const name = `nested-${randomUUID()}.pdf`;
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('folderId', folder.id)
      .field('name', name)
      .attach('file', MINIMAL_PDF, {
        filename: name,
        contentType: 'application/pdf',
      })
      .expect(200);
    const keys = (
      await testApp.prisma.file_versions.findMany({
        where: { file_id: file.id },
      })
    ).map((row) => row.storage_key);

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    for (const key of keys) {
      await expect(storage.get(key)).rejects.toBeInstanceOf(
        StorageNotFoundError,
      );
    }
  });
});
