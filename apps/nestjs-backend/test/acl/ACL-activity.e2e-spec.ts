import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { grantAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  registerActor,
  uploadPdf,
  type Actor,
  type TestFile,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

/**
 * ACL-15: activity dashboard is owner-only. Viewer and stranger see 404.
 */
describe('ACL activity dashboard is hidden from non-owners', () => {
  let testApp: TestApp;
  let owner: Actor;
  let viewer: Actor;
  let stranger: Actor;
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
    viewer = await registerActor(testApp.app);
    stranger = await registerActor(testApp.app);
    file = await uploadPdf(testApp.app, owner.cookie, {
      name: `acl-act-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
  });

  it('viewer cannot read owner summary or timeline', async () => {
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/data-rooms/${owner.roomId}/activity/summary`)
        .set('Cookie', viewer.cookie),
    );
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/data-rooms/${owner.roomId}/activity`)
        .set('Cookie', viewer.cookie),
    );
  });

  it('stranger cannot read owner summary or timeline', async () => {
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/data-rooms/${owner.roomId}/activity/summary`)
        .set('Cookie', stranger.cookie),
    );
    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/data-rooms/${owner.roomId}/activity`)
        .set('Cookie', stranger.cookie),
    );
  });

  it('stranger POST view of owner file is 404 and writes nothing', async () => {
    expectHidden(
      await request(testApp.app.getHttpServer())
        .post(`/files/${file.id}/view`)
        .set('Cookie', stranger.cookie),
    );

    expect(
      await testApp.prisma.activity_events.count({
        where: { data_room_id: owner.roomId, type: 'FILE_VIEWED' },
      }),
    ).toBe(0);
  });
});
