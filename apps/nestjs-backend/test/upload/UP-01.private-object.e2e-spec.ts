import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §4 UP-01
 * Объект нельзя скачать по постоянному URL без подписи.
 */
describe('UP-01 object is not publicly readable', () => {
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

  it('GET /storage/objects without a signature is forbidden', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `up-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const version = await testApp.prisma.file_versions.findFirstOrThrow({
      where: { file_id: file.id, version_number: 1 },
    });

    const unsigned = await request(testApp.app.getHttpServer()).get(
      `/storage/objects?key=${encodeURIComponent(version.storage_key)}`,
    );
    expect(unsigned.status).toBe(403);
    expect(unsigned.body).not.toEqual(MINIMAL_PDF);

    const empty = await request(testApp.app.getHttpServer()).get(
      '/storage/objects',
    );
    expect(empty.status).toBe(403);
  });

  it('signed download URL returns the object', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `up-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const detail = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const downloadUrl = detail.body.downloadUrl as string;
    const parsed = new URL(downloadUrl, 'http://localhost:4000');

    await request(testApp.app.getHttpServer())
      .get(`${parsed.pathname}${parsed.search}`)
      .expect(200);
  });
});
