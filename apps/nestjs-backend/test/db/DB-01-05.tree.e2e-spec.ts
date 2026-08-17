import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { MAX_FOLDER_DEPTH } from '../../src/modules/folders/folders.constants';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §5 DB-01…05 дерево папок.
 */
describe('DB-01–05 folder tree constraints', () => {
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

  it('DB-01 API rejects a parent from another data room', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', stranger.cookie)
      .send({
        name: `cross-${randomUUID()}`,
        dataRoomId: stranger.roomId,
        parentId: parent.id,
      });

    expect(response.status).not.toBe(201);
    expect([400, 404]).toContain(response.status);
  });

  it('DB-01 composite FK rejects inserting a child in the wrong room', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const id = randomUUID();

    await expect(
      testApp.prisma.folders.create({
        data: {
          id,
          name: `leak-${id}`,
          data_room_id: stranger.roomId,
          parent_id: parent.id,
          path: `/${id}/`,
        },
      }),
    ).rejects.toThrow();
  });

  it('DB-02 / DB-03 a file cannot be a folder parent', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `file-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({
        name: `under-file-${randomUUID()}`,
        parentId: file.id,
      });

    expect(response.status).toBe(404);
  });

  it('DB-04 CHECK forbids parent_id = id', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `self-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });

    await expect(
      testApp.prisma.folders.update({
        where: { id: folder.id },
        data: { parent_id: folder.id },
      }),
    ).rejects.toThrow();
  });

  it('DB-05 creating deeper than MAX_FOLDER_DEPTH is rejected', async () => {
    let parentId: string | undefined;
    for (let depth = 0; depth < MAX_FOLDER_DEPTH; depth += 1) {
      const folder = await createFolder(testApp.app, owner.cookie, {
        name: `d${depth}-${randomUUID()}`,
        dataRoomId: owner.roomId,
        parentId,
      });
      parentId = folder.id;
    }

    const response = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({
        name: `too-deep-${randomUUID()}`,
        parentId,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('folder_too_deep');
  }, 60_000);
});
