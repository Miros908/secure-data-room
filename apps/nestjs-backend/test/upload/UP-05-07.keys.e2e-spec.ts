import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerActor, uploadPdf, type Actor } from '../helpers/drive-client';

/**
 * Чек-лист §4 UP-05, UP-06, UP-07
 * Object key собирается на сервере из prefix/roomId/fileId/versionId.
 */
describe('UP-05–07 storage keys are server-owned and immutable', () => {
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

  it('UP-05/06 key is prefix/dataRoomId/fileId/versionId and ignores a path-like filename', async () => {
    const name = `../evil/${randomUUID()}.pdf`;
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    const version = await testApp.prisma.file_versions.findFirstOrThrow({
      where: { file_id: file.id, version_number: 1 },
    });

    expect(version.storage_key).toBe(
      `test/${owner.roomId}/${file.id}/${version.id}`,
    );
    expect(version.storage_key).not.toContain('evil');
    expect(version.storage_key).not.toContain('..');
    expect(file.name).not.toContain('..');
    expect(file.name).not.toContain('/');
  });

  it('UP-07 two uploads and a rename keep distinct immutable keys', async () => {
    const first = await uploadPdf(testApp.app, owner.cookie, {
      name: `a-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const second = await uploadPdf(testApp.app, owner.cookie, {
      name: `b-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const firstRow = await testApp.prisma.file_versions.findFirstOrThrow({
      where: { file_id: first.id, version_number: 1 },
    });
    const secondRow = await testApp.prisma.file_versions.findFirstOrThrow({
      where: { file_id: second.id, version_number: 1 },
    });

    expect(firstRow.storage_key).not.toBe(secondRow.storage_key);

    await request(testApp.app.getHttpServer())
      .patch(`/files/${first.id}`)
      .set('Cookie', owner.cookie)
      .send({ name: `renamed-${randomUUID()}.pdf` })
      .expect(200);

    const afterRename = await testApp.prisma.file_versions.findFirstOrThrow({
      where: { file_id: first.id, version_number: 1 },
    });
    expect(afterRename.storage_key).toBe(firstRow.storage_key);
  });
});
