import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { hashShareToken } from '../../src/modules/access/utils/share-token';
import { createPublicLink } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §3 SHARE-01, SHARE-02, SHARE-03
 * Public token случайный, в БД hash, raw token не светится в API-ошибках и логах.
 */
describe('SHARE-01–03 public token storage and leakage', () => {
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
    testApp.logs.length = 0;
    owner = await registerActor(testApp.app);
  });

  it('SHARE-01 create public link token is 32-byte hex', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `share-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'folder',
      id: folder.id,
    });

    expect(link.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('SHARE-02 DB stores sha256, not the raw token', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `share-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'folder',
      id: folder.id,
    });

    const row = await testApp.prisma.public_share_links.findUniqueOrThrow({
      where: { id: link.id },
    });

    expect(row.token_hash).toBe(hashShareToken(link.token));
    expect(row.token_hash).not.toBe(link.token);
  });

  it('SHARE-03 file JSON and 404 body do not echo the token', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `share-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    const ok = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}?token=${link.token}`)
      .expect(200);
    expect(JSON.stringify(ok.body)).not.toContain(link.token);

    const missing = await request(testApp.app.getHttpServer())
      .get(`/files/${randomUUID()}?token=${link.token}`)
      .expect(404);
    expect(JSON.stringify(missing.body)).not.toContain(link.token);
  });

  it('SHARE-03 warn/error logs do not contain the raw token', async () => {
    const marker = `tokensecret${randomUUID().replaceAll('-', '')}`;

    await request(testApp.app.getHttpServer()).get(
      `/access/public-links/resolve?token=${marker}`,
    );

    const dumped = testApp.logs.join('\n');
    expect(dumped).not.toContain(marker);
  });
});
