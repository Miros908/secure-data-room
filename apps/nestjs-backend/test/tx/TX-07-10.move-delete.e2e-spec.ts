import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §6 TX-07…10 move/delete/create vs ancestor.
 */
describe('TX-07–10 move and delete races', () => {
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

  it('TX-07 move and delete of the same file leave no half-moved row', async () => {
    const dest = await createFolder(testApp.app, owner.cookie, {
      name: `dest-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `src-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    const [moved, deleted] = await Promise.all([
      request(testApp.app.getHttpServer())
        .post(`/files/${file.id}/move`)
        .set('Cookie', owner.cookie)
        .send({ folderId: dest.id }),
      request(testApp.app.getHttpServer())
        .delete(`/files/${file.id}`)
        .set('Cookie', owner.cookie),
    ]);

    expect([moved.status, deleted.status]).not.toContain(500);
    expect([201, 404]).toContain(moved.status);
    expect([200, 404]).toContain(deleted.status);

    const row = await testApp.prisma.files.findUnique({
      where: { id: file.id },
    });
    if (row) {
      expect(row.folder_id === null || row.folder_id === dest.id).toBe(true);
      expect(deleted.status).toBe(404);
    } else {
      expect(deleted.status).toBe(200);
    }
  });

  it('TX-08 move into a folder deleted in parallel never dangles folder_id', async () => {
    const dest = await createFolder(testApp.app, owner.cookie, {
      name: `dest-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `mv-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    const [moved, deleted] = await Promise.all([
      request(testApp.app.getHttpServer())
        .post(`/files/${file.id}/move`)
        .set('Cookie', owner.cookie)
        .send({ folderId: dest.id }),
      request(testApp.app.getHttpServer())
        .delete(`/folders/${dest.id}`)
        .set('Cookie', owner.cookie),
    ]);

    expect([moved.status, deleted.status]).not.toContain(500);
    expect([201, 404]).toContain(moved.status);
    expect(deleted.status).toBe(200);

    const row = await testApp.prisma.files.findUnique({
      where: { id: file.id },
    });
    if (row?.folder_id) {
      const folder = await testApp.prisma.folders.findUnique({
        where: { id: row.folder_id },
      });
      expect(folder).not.toBeNull();
    }
  });

  it('TX-09 create child and delete ancestor do not leave an orphan folder', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });

    const [created, deleted] = await Promise.all([
      request(testApp.app.getHttpServer())
        .post('/folders')
        .set('Cookie', owner.cookie)
        .send({
          name: `child-${randomUUID()}`,
          parentId: parent.id,
        }),
      request(testApp.app.getHttpServer())
        .delete(`/folders/${parent.id}`)
        .set('Cookie', owner.cookie),
    ]);

    expect([created.status, deleted.status]).not.toContain(500);
    expect([201, 404]).toContain(created.status);
    expect(deleted.status).toBe(200);

    const parentRow = await testApp.prisma.folders.findUnique({
      where: { id: parent.id },
    });
    expect(parentRow).toBeNull();

    if (created.status === 201) {
      const child = await testApp.prisma.folders.findUnique({
        where: { id: created.body.id as string },
      });
      expect(child).toBeNull();
    }

    const orphans = await testApp.prisma.folders.findMany({
      where: { parent_id: parent.id },
    });
    expect(orphans).toHaveLength(0);
  });

  it('TX-10 upload into a folder deleted in parallel is 201 or 404, never a live orphan', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `up-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const name = `in-${randomUUID()}.pdf`;

    const [uploaded, deleted] = await Promise.all([
      request(testApp.app.getHttpServer())
        .post('/files')
        .set('Cookie', owner.cookie)
        .field('dataRoomId', owner.roomId)
        .field('folderId', folder.id)
        .field('name', name)
        .attach('file', MINIMAL_PDF, {
          filename: name,
          contentType: 'application/pdf',
        }),
      request(testApp.app.getHttpServer())
        .delete(`/folders/${folder.id}`)
        .set('Cookie', owner.cookie),
    ]);

    expect([uploaded.status, deleted.status]).not.toContain(500);
    expect([201, 400, 404]).toContain(uploaded.status);
    expect(deleted.status).toBe(200);

    if (uploaded.status === 201) {
      const row = await testApp.prisma.files.findUnique({
        where: { id: uploaded.body.id as string },
      });
      expect(row).toBeNull();
    }
  });
});
