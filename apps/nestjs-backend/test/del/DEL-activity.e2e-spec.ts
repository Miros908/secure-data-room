import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { ActivityEventType } from '../../src/database/generated/prisma/enums';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * DEL-13: file delete writes FILE_DELETED; folder delete writes one FOLDER_DELETED.
 */
describe('DEL activity events', () => {
  let testApp: TestApp;
  let owner: Actor;

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

  it('deleting a file keeps FILE_DELETED after the row is gone', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `del-act-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const row = await testApp.prisma.activity_events.findFirstOrThrow({
      where: { type: ActivityEventType.FILE_DELETED },
    });
    expect(row.file_id).toBe(file.id);
    expect(row.resource_name).toBe(file.name);
    expect(
      await testApp.prisma.files.findUnique({ where: { id: file.id } }),
    ).toBeNull();
  });

  it('deleting a folder writes one FOLDER_DELETED, not N file events', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `del-folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `a-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `b-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(
      await testApp.prisma.activity_events.count({
        where: { type: ActivityEventType.FOLDER_DELETED },
      }),
    ).toBe(1);
    expect(
      await testApp.prisma.activity_events.count({
        where: { type: ActivityEventType.FILE_DELETED },
      }),
    ).toBe(0);

    const row = await testApp.prisma.activity_events.findFirstOrThrow({
      where: { type: ActivityEventType.FOLDER_DELETED },
    });
    expect(row.folder_id).toBe(folder.id);
    expect(row.metadata).toMatchObject({
      deletedFolders: 1,
      deletedFiles: 2,
    });
  });
});
