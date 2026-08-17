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
 * Чек-лист §6 TX-04…06 гонки имён.
 */
describe('TX-04–06 concurrent names', () => {
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

  it('TX-04 two concurrent folder creates of the same name: one 201, one 409', async () => {
    const name = `race-${randomUUID()}`;
    const [first, second] = await Promise.all([
      request(testApp.app.getHttpServer())
        .post('/folders')
        .set('Cookie', owner.cookie)
        .send({ name, dataRoomId: owner.roomId }),
      request(testApp.app.getHttpServer())
        .post('/folders')
        .set('Cookie', owner.cookie)
        .send({ name, dataRoomId: owner.roomId }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect([first.body.code, second.body.code]).toContain('name_taken');

    const rows = await testApp.prisma.folders.findMany({
      where: { data_room_id: owner.roomId, parent_id: null, name },
    });
    expect(rows).toHaveLength(1);
  });

  it('TX-04 two concurrent uploads of the same name: one file, two versions', async () => {
    const name = `race-${randomUUID()}.pdf`;
    const post = () =>
      request(testApp.app.getHttpServer())
        .post('/files')
        .set('Cookie', owner.cookie)
        .field('dataRoomId', owner.roomId)
        .field('name', name)
        .attach('file', MINIMAL_PDF, {
          filename: name,
          contentType: 'application/pdf',
        });

    const [first, second] = await Promise.all([post(), post()]);
    if (
      (first.status !== 200 && first.status !== 201) ||
      (second.status !== 200 && second.status !== 201)
    ) {
      throw new Error(
        `upload race: ${first.status} ${JSON.stringify(first.body)} / ${second.status} ${JSON.stringify(second.body)}`,
      );
    }

    const rows = await testApp.prisma.files.findMany({
      where: { data_room_id: owner.roomId, folder_id: null, name },
    });
    expect(rows).toHaveLength(1);
    const versions = await testApp.prisma.file_versions.findMany({
      where: { file_id: rows[0].id },
    });
    expect(versions).toHaveLength(2);
    expect(new Set(versions.map((version) => version.storage_key)).size).toBe(
      2,
    );
  });

  it('TX-05 two concurrent renames onto the same name do not duplicate it', async () => {
    const left = await createFolder(testApp.app, owner.cookie, {
      name: `left-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const right = await createFolder(testApp.app, owner.cookie, {
      name: `right-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const target = `taken-${randomUUID()}`;

    const [first, second] = await Promise.all([
      request(testApp.app.getHttpServer())
        .patch(`/folders/${left.id}`)
        .set('Cookie', owner.cookie)
        .send({ name: target }),
      request(testApp.app.getHttpServer())
        .patch(`/folders/${right.id}`)
        .set('Cookie', owner.cookie)
        .send({ name: target }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect([first.body.code, second.body.code]).toContain('name_taken');

    const rows = await testApp.prisma.folders.findMany({
      where: { data_room_id: owner.roomId, name: target },
    });
    expect(rows).toHaveLength(1);
  });

  it('TX-06 rename to an occupied name is rejected by the unique index', async () => {
    const taken = `held-${randomUUID()}`;
    await createFolder(testApp.app, owner.cookie, {
      name: taken,
      dataRoomId: owner.roomId,
    });
    const other = await createFolder(testApp.app, owner.cookie, {
      name: `other-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });

    const api = await request(testApp.app.getHttpServer())
      .patch(`/folders/${other.id}`)
      .set('Cookie', owner.cookie)
      .send({ name: taken });
    expect(api.status).toBe(409);
    expect(api.body.code).toBe('name_taken');

    await expect(
      testApp.prisma.folders.update({
        where: { id: other.id },
        data: { name: taken },
      }),
    ).rejects.toThrow();
  });

  it('TX-16 rename of a file deleted in parallel is 200 or 404, never 500', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `gone-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });

    const [renamed, deleted] = await Promise.all([
      request(testApp.app.getHttpServer())
        .patch(`/files/${file.id}`)
        .set('Cookie', owner.cookie)
        .send({ name: `after-${randomUUID()}.pdf` }),
      request(testApp.app.getHttpServer())
        .delete(`/files/${file.id}`)
        .set('Cookie', owner.cookie),
    ]);

    expect([renamed.status, deleted.status]).not.toContain(500);
    expect([200, 404]).toContain(renamed.status);
    expect([200, 404]).toContain(deleted.status);

    const row = await testApp.prisma.files.findUnique({
      where: { id: file.id },
    });
    if (deleted.status === 200) {
      expect(row).toBeNull();
    }
  });
});
