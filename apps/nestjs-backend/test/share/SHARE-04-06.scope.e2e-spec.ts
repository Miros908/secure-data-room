import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createPublicLink } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
  type TestFile,
  type TestFolder,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §3 SHARE-04, SHARE-05, SHARE-06
 * Public link открывает только target и потомков; breadcrumbs и соседние узлы закрыты.
 */
describe('SHARE-04–06 public link scope', () => {
  let testApp: TestApp;
  let owner: Actor;
  let parent: TestFolder;
  let shared: TestFolder;
  let child: TestFolder;
  let sibling: TestFolder;
  let childFile: TestFile;
  let siblingFile: TestFile;
  let token: string;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    shared = await createFolder(testApp.app, owner.cookie, {
      name: `shared-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    child = await createFolder(testApp.app, owner.cookie, {
      name: `child-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: shared.id,
    });
    sibling = await createFolder(testApp.app, owner.cookie, {
      name: `sibling-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    childFile = await uploadPdf(testApp.app, owner.cookie, {
      name: `child-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: child.id,
    });
    siblingFile = await uploadPdf(testApp.app, owner.cookie, {
      name: `sibling-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: sibling.id,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'folder',
      id: shared.id,
    });
    token = link.token;
  });

  it('SHARE-04 token opens shared folder and descendants, not room/parent/sibling', async () => {
    const server = testApp.app.getHttpServer();

    const sharedListing = await request(server)
      .get(`/folders/${shared.id}?token=${token}`)
      .expect(200);
    expect(
      sharedListing.body.folders.map((item: { id: string }) => item.id),
    ).toContain(child.id);
    expect(
      sharedListing.body.folders.map((item: { id: string }) => item.id),
    ).not.toContain(sibling.id);

    await request(server)
      .get(`/folders/${child.id}?token=${token}`)
      .expect(200);
    const file = await request(server)
      .get(`/files/${childFile.id}?token=${token}`)
      .expect(200);
    expect(file.body.downloadUrl).toEqual(expect.any(String));

    expectHidden(
      await request(server).get(`/data-rooms/${owner.roomId}?token=${token}`),
    );
    expectHidden(
      await request(server).get(`/folders/${parent.id}?token=${token}`),
    );
    expectHidden(
      await request(server).get(`/folders/${sibling.id}?token=${token}`),
    );
    expectHidden(
      await request(server).get(`/files/${siblingFile.id}?token=${token}`),
    );
  });

  it('SHARE-05 breadcrumbs stop at the shared folder, not the private parent', async () => {
    const sharedListing = await request(testApp.app.getHttpServer())
      .get(`/folders/${shared.id}?token=${token}`)
      .expect(200);
    const sharedCrumbs = (
      sharedListing.body.breadcrumbs as Array<{ id: string }>
    ).map((crumb) => crumb.id);
    expect(sharedCrumbs).toEqual([shared.id]);
    expect(sharedCrumbs).not.toContain(parent.id);

    const childListing = await request(testApp.app.getHttpServer())
      .get(`/folders/${child.id}?token=${token}`)
      .expect(200);
    const childCrumbs = (
      childListing.body.breadcrumbs as Array<{ id: string }>
    ).map((crumb) => crumb.id);
    expect(childCrumbs).toEqual([shared.id, child.id]);
    expect(childCrumbs).not.toContain(parent.id);
  });

  it('SHARE-06 file public link does not open the parent folder', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `direct-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: parent.id,
    });
    const fileLink = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}?token=${fileLink.token}`)
      .expect(200);

    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/folders/${parent.id}?token=${fileLink.token}`,
      ),
    );
    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/data-rooms/${owner.roomId}?token=${fileLink.token}`,
      ),
    );
  });
});
