import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DEFAULT_DOWNLOAD_TTL_SECONDS } from '../../src/infrastructure/storage/storage.service';
import { createPublicLink, revokeAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  registerActor,
  uploadPdf,
  type Actor,
  type TestFile,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §3 SHARE-07, SHARE-08
 * Revoke закрывает новые download URL. Уже выданный signed URL живёт не дольше TTL.
 */
describe('SHARE-07–08 revoke and signed URL window', () => {
  let testApp: TestApp;
  let owner: Actor;
  let file: TestFile;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    file = await uploadPdf(testApp.app, owner.cookie, {
      name: `share-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
  });

  it('SHARE-07 revoke stops new GET /files/:id?token= download URLs', async () => {
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    const before = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}?token=${link.token}`)
      .expect(200);
    expect(before.body.downloadUrl).toEqual(expect.any(String));

    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'public_link',
      id: link.id,
    });

    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/files/${file.id}?token=${link.token}`,
      ),
    );
  });

  it('SHARE-08 downloadUrlExpiresAt is within the signed URL TTL', async () => {
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });
    const before = Date.now();
    const response = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}?token=${link.token}`)
      .expect(200);
    const expires = new Date(
      response.body.downloadUrlExpiresAt as string,
    ).getTime();

    expect(expires).toBeGreaterThan(before);
    expect(expires).toBeLessThanOrEqual(
      before + DEFAULT_DOWNLOAD_TTL_SECONDS * 1000 + 2000,
    );
  });

  it('SHARE-08 already issued signed URL still works until TTL after revoke', async () => {
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });
    const issued = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}?token=${link.token}`)
      .expect(200);
    const downloadUrl = issued.body.downloadUrl as string;
    const path =
      new URL(downloadUrl, 'http://localhost:4000').pathname +
      new URL(downloadUrl, 'http://localhost:4000').search;

    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'public_link',
      id: link.id,
    });

    await request(testApp.app.getHttpServer()).get(path).expect(200);
  });
});
