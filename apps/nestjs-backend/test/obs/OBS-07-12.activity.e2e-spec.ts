import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '@sdr/shared/http';
import { GUEST_ACTIVITY_NAME } from '@sdr/shared/activity';
import request from 'supertest';
import { ActivityEventType } from '../../src/database/generated/prisma/enums';
import { createPublicLink, grantAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  listFileVersions,
  registerActor,
  uploadPdf,
  type Actor,
  type TestFile,
} from '../helpers/drive-client';

/**
 * Чек-лист §13 OBS-07…12
 * Просмотр пишется с POST /files/:id/view, не с GET (OBS-12).
 * Скачивание — каждый клик. requestId сохраняется (OBS-08).
 */
describe('OBS-07–12 activity audit', () => {
  let testApp: TestApp;
  let owner: Actor;
  let viewer: Actor;
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
    file = await uploadPdf(testApp.app, owner.cookie, {
      name: `obs-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
  });

  it('OBS-12 GET file and version URLs do not write FILE_VIEWED', async () => {
    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);
    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    const versions = await listFileVersions(
      testApp.app,
      viewer.cookie,
      file.id,
    );
    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}/versions/${versions[0]!.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(await countEvents(ActivityEventType.FILE_VIEWED)).toBe(0);
  });

  it('OBS-07 / OBS-12 POST view is recorded once per 15 minutes', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/view`)
      .set('Cookie', viewer.cookie)
      .expect(200);
    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/view`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(await countEvents(ActivityEventType.FILE_VIEWED)).toBe(1);
  });

  it('OBS-07 concurrent views still record once', async () => {
    const responses = await Promise.all([
      request(testApp.app.getHttpServer())
        .post(`/files/${file.id}/view`)
        .set('Cookie', viewer.cookie),
      request(testApp.app.getHttpServer())
        .post(`/files/${file.id}/view`)
        .set('Cookie', viewer.cookie),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await countEvents(ActivityEventType.FILE_VIEWED)).toBe(1);
  });

  it('OBS-07 POST download is recorded on every click and uses attachment', async () => {
    const first = await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/download`)
      .set('Cookie', viewer.cookie)
      .expect(200);
    const second = await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/download`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    expect(first.body.downloadUrl).toContain('disposition=attachment');
    expect(second.body.downloadUrl).not.toBeUndefined();
    expect(await countEvents(ActivityEventType.FILE_DOWNLOADED)).toBe(2);

    const parsed = new URL(
      first.body.downloadUrl as string,
      'http://localhost:4000',
    );
    const download = await request(testApp.app.getHttpServer())
      .get(`${parsed.pathname}${parsed.search}`)
      .expect(200);
    expect(String(download.headers['content-disposition'] ?? '')).toMatch(
      /^attachment;/i,
    );
  });

  it('OBS-08 stores the request id on the event', async () => {
    const requestId = 'obs-08-view-event';
    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/view`)
      .set('Cookie', viewer.cookie)
      .set(REQUEST_ID_HEADER, requestId)
      .expect(200);

    const row = await testApp.prisma.activity_events.findFirstOrThrow({
      where: { type: ActivityEventType.FILE_VIEWED },
    });
    expect(row.request_id).toBe(requestId);
  });

  it('owner views are stored but excluded from visitors', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/view`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(await countEvents(ActivityEventType.FILE_VIEWED)).toBe(1);

    const summary = await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}/activity/summary`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(summary.body.totals.uniqueVisitors).toBe(0);
    expect(summary.body.totals.views).toBe(0);
    expect(summary.body.visitors).toEqual([]);
    expect(summary.body.topFiles).toEqual([]);
  });

  it('summary lists a granted viewer, not the owner', async () => {
    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/view`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    const summary = await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}/activity/summary`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(summary.body.totals.uniqueVisitors).toBe(1);
    expect(summary.body.visitors[0].actor.email).toBe(viewer.email);
    expect(summary.body.topFiles[0]).toMatchObject({
      fileId: file.id,
      name: file.name,
      viewCount: 1,
    });
  });

  it('public-link guest is shown as Гость по ссылке and never stores the token', async () => {
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    await request(testApp.app.getHttpServer())
      .get('/access/public-links/resolve')
      .query({ token: link.token })
      .expect(200);
    await request(testApp.app.getHttpServer())
      .post(`/files/${file.id}/view`)
      .query({ token: link.token })
      .expect(200);

    const summary = await request(testApp.app.getHttpServer())
      .get(`/data-rooms/${owner.roomId}/activity/summary`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(summary.body.visitors[0].actor).toMatchObject({
      kind: 'guest',
      name: GUEST_ACTIVITY_NAME,
      email: null,
    });

    const dumped = JSON.stringify(summary.body);
    expect(dumped).not.toContain(link.token);

    const view = await testApp.prisma.activity_events.findFirstOrThrow({
      where: { type: ActivityEventType.FILE_VIEWED, actor_user_id: null },
    });
    expect(view.public_share_link_id).toBe(link.id);
    expect(JSON.stringify(view.metadata)).not.toContain(link.token);
  });

  async function countEvents(type: ActivityEventType): Promise<number> {
    return testApp.prisma.activity_events.count({
      where: { data_room_id: owner.roomId, type },
    });
  }
});
