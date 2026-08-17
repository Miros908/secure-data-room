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
 * Чек-лист §5 DB-06…09 уникальность имён.
 */
describe('DB-06–09 sibling names', () => {
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

  it('DB-06 duplicate folder name is 409 and also a DB unique violation', async () => {
    const name = `dup-${randomUUID()}`;
    const first = await createFolder(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });

    const api = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({ name, dataRoomId: owner.roomId });
    expect(api.status).toBe(409);
    expect(api.body.code).toBe('name_taken');

    await expect(
      testApp.prisma.folders.create({
        data: {
          name,
          data_room_id: owner.roomId,
          parent_id: null,
          path: `/${randomUUID()}/`,
        },
      }),
    ).rejects.toThrow();

    await expect(
      testApp.prisma.folders.create({
        data: {
          name,
          data_room_id: owner.roomId,
          parent_id: first.id,
          path: `/${randomUUID()}/`,
        },
      }),
    ).resolves.toBeDefined();
  });

  it('DB-07 trim: padded name collides with trimmed', async () => {
    const name = `trim-${randomUUID()}`;
    await createFolder(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });

    const padded = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({ name: `  ${name}  `, dataRoomId: owner.roomId });

    expect(padded.status).toBe(409);
    expect(padded.body.code).toBe('name_taken');
  });

  it('DB-07 unicode NFC and NFD of the same letters collide', async () => {
    const suffix = randomUUID();
    const nfc = `cafe\u00e9-${suffix}`;
    const nfd = `cafe\u0065\u0301-${suffix}`;
    await createFolder(testApp.app, owner.cookie, {
      name: nfc,
      dataRoomId: owner.roomId,
    });

    const again = await request(testApp.app.getHttpServer())
      .post('/folders')
      .set('Cookie', owner.cookie)
      .send({ name: nfd, dataRoomId: owner.roomId });

    expect(again.status).toBe(409);
    expect(again.body.code).toBe('name_taken');
  });

  it('DB-08 two root folders cannot share a name; nested can reuse it', async () => {
    const name = `root-${randomUUID()}`;
    await createFolder(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    const nestedParent = await createFolder(testApp.app, owner.cookie, {
      name: `holder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const nested = await createFolder(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
      parentId: nestedParent.id,
    });
    expect(nested.name).toBe(name);
  });

  it('DB-09 after delete the name can be reused', async () => {
    const name = `reuse-${randomUUID()}`;
    const folder = await createFolder(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    await uploadPdf(testApp.app, owner.cookie, {
      name: `inner-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });

    await request(testApp.app.getHttpServer())
      .delete(`/folders/${folder.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    const again = await createFolder(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    expect(again.name).toBe(name);
  });
});
