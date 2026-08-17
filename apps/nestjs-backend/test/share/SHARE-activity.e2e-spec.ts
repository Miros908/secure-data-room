import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { ActivityEventType } from '../../src/database/generated/prisma/enums';
import {
  createPublicLink,
  grantAccess,
  revokeAccess,
} from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerSession } from '../helpers/auth-client';
import { registerActor, uploadPdf, type Actor } from '../helpers/drive-client';

/**
 * SHARE: grant/revoke/public-link resolve write activity in the same mutation path.
 */
describe('SHARE activity events', () => {
  let testApp: TestApp;
  let owner: Actor;
  let viewer: Actor;

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
  });

  it('grant and revoke write ACCESS_GRANTED then ACCESS_REVOKED', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `share-act-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const grant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });

    expect(
      await testApp.prisma.activity_events.count({
        where: { type: ActivityEventType.ACCESS_GRANTED, file_id: file.id },
      }),
    ).toBe(1);

    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'grant',
      id: grant.id,
    });

    expect(
      await testApp.prisma.activity_events.count({
        where: { type: ActivityEventType.ACCESS_REVOKED, file_id: file.id },
      }),
    ).toBe(1);
  });

  it('creating a public link writes ACCESS_GRANTED with the link id', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `link-act-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    const row = await testApp.prisma.activity_events.findFirstOrThrow({
      where: { type: ActivityEventType.ACCESS_GRANTED, file_id: file.id },
    });
    expect(row.public_share_link_id).toBe(link.id);
    expect(row.metadata).toMatchObject({ kind: 'public_link' });
  });

  it('resolving a public link writes LINK_OPENED once per window', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `open-act-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });

    await request(testApp.app.getHttpServer())
      .get('/access/public-links/resolve')
      .query({ token: link.token })
      .expect(200);
    await request(testApp.app.getHttpServer())
      .get('/access/public-links/resolve')
      .query({ token: link.token })
      .expect(200);

    const rows = await testApp.prisma.activity_events.findMany({
      where: { type: ActivityEventType.LINK_OPENED },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.public_share_link_id).toBe(link.id);
    expect(rows[0]?.actor_user_id).toBeNull();
  });

  it('accepting an invite on register writes ACCESS_GRANTED', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `invite-act-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const email = `invitee-${randomUUID()}@example.test`;

    await request(testApp.app.getHttpServer())
      .post('/access/invitations')
      .set('Cookie', owner.cookie)
      .send({
        email,
        role: 'viewer',
        type: 'file',
        id: file.id,
      })
      .expect(201);

    expect(
      await testApp.prisma.activity_events.count({
        where: { type: ActivityEventType.ACCESS_GRANTED, file_id: file.id },
      }),
    ).toBe(0);

    await registerSession(testApp.app, { email });

    const row = await testApp.prisma.activity_events.findFirstOrThrow({
      where: { type: ActivityEventType.ACCESS_GRANTED, file_id: file.id },
    });
    expect(row.metadata).toMatchObject({ kind: 'invite', email });
  });
});
