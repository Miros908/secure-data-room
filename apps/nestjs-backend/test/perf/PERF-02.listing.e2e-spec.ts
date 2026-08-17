import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §10 PERF-02, PERF-03: listing — только прямые дети.
 */
describe('PERF-02 / PERF-03 listing is one folder level', () => {
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

  it('root listing does not include a nested file or nested folder children', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `p-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const child = await createFolder(testApp.app, owner.cookie, {
      name: `c-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    const nested = await uploadPdf(testApp.app, owner.cookie, {
      name: `nested-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: child.id,
    });
    const rootFile = await uploadPdf(testApp.app, owner.cookie, {
      name: `root-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    const root = await request(testApp.app.getHttpServer())
      .get(`/folders?dataRoomId=${owner.roomId}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const rootFolderIds = (root.body.folders as Array<{ id: string }>).map(
      (folder) => folder.id,
    );
    const rootFileIds = (root.body.files as Array<{ id: string }>).map(
      (file) => file.id,
    );

    expect(rootFolderIds).toContain(parent.id);
    expect(rootFolderIds).not.toContain(child.id);
    expect(rootFileIds).toContain(rootFile.id);
    expect(rootFileIds).not.toContain(nested.id);

    const insideParent = await request(testApp.app.getHttpServer())
      .get(`/folders/${parent.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(
      (insideParent.body.folders as Array<{ id: string }>).map(
        (folder) => folder.id,
      ),
    ).toEqual([child.id]);
    expect(insideParent.body.files).toEqual([]);
  });
});
