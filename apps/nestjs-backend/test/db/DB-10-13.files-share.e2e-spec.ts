import { randomUUID } from 'node:crypto';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §5 DB-10…13 ключ версии и target шаринга.
 */
describe('DB-10–13 file object and share target', () => {
  let testApp: TestApp;
  let owner: Actor;
  let stranger: Actor;

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
  });

  it('DB-10 / DB-12 each version has one unique storage_key; file has one current', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `obj-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const row = await testApp.prisma.files.findUniqueOrThrow({
      where: { id: file.id },
    });
    expect(row.current_version_id).toBeTruthy();
    const version = await testApp.prisma.file_versions.findUniqueOrThrow({
      where: { id: row.current_version_id! },
    });
    expect(version.storage_key.length).toBeGreaterThan(0);
    expect(version.file_id).toBe(file.id);

    await expect(
      testApp.prisma.file_versions.create({
        data: {
          file_id: file.id,
          version_number: 99,
          storage_key: version.storage_key,
          mime_type: 'application/pdf',
          size_bytes: 4,
          uploaded_by_id: owner.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('DB-11 empty storage_key is rejected', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `empty-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    await expect(
      testApp.prisma.file_versions.create({
        data: {
          file_id: file.id,
          version_number: 2,
          storage_key: '',
          mime_type: 'application/pdf',
          size_bytes: 4,
          uploaded_by_id: owner.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('current_version_id cannot point at another file', async () => {
    const first = await uploadPdf(testApp.app, owner.cookie, {
      name: `a-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const second = await uploadPdf(testApp.app, owner.cookie, {
      name: `b-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const otherVersion = await testApp.prisma.file_versions.findFirstOrThrow({
      where: { file_id: second.id },
    });

    await expect(
      testApp.prisma.files.update({
        where: { id: first.id },
        data: { current_version_id: otherVersion.id },
      }),
    ).rejects.toThrow();
  });

  it('DB-13 grant cannot point at folder and file together', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `g-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `g-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });

    await expect(
      testApp.prisma.access_grants.create({
        data: {
          user_id: stranger.id,
          granted_by_id: owner.id,
          data_room_id: owner.roomId,
          folder_id: folder.id,
          file_id: file.id,
          role: 'VIEWER',
        },
      }),
    ).rejects.toThrow();
  });
});
