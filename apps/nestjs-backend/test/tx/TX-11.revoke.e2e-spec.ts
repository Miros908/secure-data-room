import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createPublicLink, revokeAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerActor, uploadPdf, type Actor } from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * Чек-лист §6 TX-11 revoke vs выдача signed GET.
 * После гонки новый GET с токеном — 404. In-flight GET может успеть отдать URL
 * (SHARE-08: уже выданный signed URL живёт до TTL).
 */
describe('TX-11 revoke vs signed GET', () => {
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

  it('after concurrent revoke and GET, a later GET is 404', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `tx-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    const [revoked, inflight] = await Promise.all([
      request(testApp.app.getHttpServer())
        .post('/access/revoke')
        .set('Cookie', owner.cookie)
        .send({ kind: 'public_link', id: link.id }),
      request(testApp.app.getHttpServer()).get(
        `/files/${file.id}?token=${link.token}`,
      ),
    ]);

    expect(revoked.status).toBe(200);
    expect([200, 404]).toContain(inflight.status);
    expect(inflight.status).not.toBe(500);

    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/files/${file.id}?token=${link.token}`,
      ),
    );
  });
});
