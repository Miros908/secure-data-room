import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  createPublicLink,
  grantAccess,
  revokeAccess,
} from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  createFolder,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { SseClient } from '../helpers/sse-client';

describe('live events stream', () => {
  let testApp: TestApp;
  let port: number;
  let owner: Actor;
  let viewer: Actor;

  beforeAll(async () => {
    testApp = await createTestApp();
    port = testApp.port;
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    viewer = await registerActor(testApp.app);
  });

  it('handshake without cookie or token is 401', async () => {
    await expect(SseClient.open({ port })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('handshake with a dead public token is 404', async () => {
    await expect(
      SseClient.open({ port, token: 'a'.repeat(64) }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not send another user a grant revoke', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `secret-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const grant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
    const stranger = await registerActor(testApp.app);
    const stream = await SseClient.open({
      port,
      cookie: stranger.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      await revokeAccess(testApp.app, owner.cookie, {
        kind: 'grant',
        id: grant.id,
      });
      await expect(stream.waitFor('access_invalidated', 800)).rejects.toThrow(
        /timed out/,
      );
    } finally {
      stream.close();
    }
  });

  it('notifies the viewer on grant', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `granted-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const stream = await SseClient.open({
      port,
      cookie: viewer.cookie,
    });

    try {
      await stream.waitFor('ping');
      await grantAccess(testApp.app, owner.cookie, {
        userId: viewer.id,
        role: 'viewer',
        type: 'file',
        id: file.id,
      });
      const frame = await stream.waitFor('access_granted');
      expect(frame.data).toMatchObject({
        type: 'access_granted',
        dataRoomId: owner.roomId,
        target: { kind: 'file', id: file.id },
      });
    } finally {
      stream.close();
    }
  });

  it('notifies the viewer on grant revoke; the next GET is 404', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `live-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const grant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
    const stream = await SseClient.open({
      port,
      cookie: viewer.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      await revokeAccess(testApp.app, owner.cookie, {
        kind: 'grant',
        id: grant.id,
      });
      const frame = await stream.waitFor('access_invalidated');
      expect(frame.data).toMatchObject({
        type: 'access_invalidated',
        reason: 'revoked',
        dataRoomId: owner.roomId,
        target: { kind: 'file', id: file.id },
      });
    } finally {
      stream.close();
    }

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(404);
  });

  it('SHARE-12: folder revoke still leaves a direct file GET at 200', async () => {
    const folder = await createFolder(testApp.app, owner.cookie, {
      name: `folder-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `kept-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
      folderId: folder.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
    const folderGrant = await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: folder.id,
    });
    const stream = await SseClient.open({
      port,
      cookie: viewer.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      await revokeAccess(testApp.app, owner.cookie, {
        kind: 'grant',
        id: folderGrant.id,
      });
      await stream.waitFor('access_invalidated');
    } finally {
      stream.close();
    }

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(200);
  });

  it('notifies a child-folder viewer when the parent is deleted', async () => {
    const parent = await createFolder(testApp.app, owner.cookie, {
      name: `parent-${randomUUID()}`,
      dataRoomId: owner.roomId,
    });
    const child = await createFolder(testApp.app, owner.cookie, {
      name: `child-${randomUUID()}`,
      dataRoomId: owner.roomId,
      parentId: parent.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'folder',
      id: parent.id,
    });
    const stream = await SseClient.open({
      port,
      cookie: viewer.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      await request(testApp.app.getHttpServer())
        .delete(`/folders/${parent.id}`)
        .set('Cookie', owner.cookie)
        .expect(200);
      const frame = await stream.waitFor('resource_gone');
      expect(frame.data).toMatchObject({
        type: 'resource_gone',
        reason: 'deleted',
        subject: { kind: 'folder', id: parent.id },
      });
    } finally {
      stream.close();
    }

    await request(testApp.app.getHttpServer())
      .get(`/folders/${child.id}`)
      .set('Cookie', viewer.cookie)
      .expect(404);
  });

  it('notifies the room on file delete', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `gone-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
    const stream = await SseClient.open({
      port,
      cookie: viewer.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      await request(testApp.app.getHttpServer())
        .delete(`/files/${file.id}`)
        .set('Cookie', owner.cookie)
        .expect(200);
      await stream.waitFor('resource_gone');
    } finally {
      stream.close();
    }

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', viewer.cookie)
      .expect(404);
  });

  it('does not fan out a delete to a stranger who guessed dataRoomId', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `guess-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const stranger = await registerActor(testApp.app);
    const stream = await SseClient.open({
      port,
      cookie: stranger.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      await request(testApp.app.getHttpServer())
        .delete(`/files/${file.id}`)
        .set('Cookie', owner.cookie)
        .expect(200);
      await expect(stream.waitFor('resource_gone', 800)).rejects.toThrow(
        /timed out/,
      );
    } finally {
      stream.close();
    }
  });

  it('notifies a public-link stream on revoke', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `public-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });
    const stream = await SseClient.open({ port, token: link.token });

    try {
      await stream.waitFor('ping');
      await revokeAccess(testApp.app, owner.cookie, {
        kind: 'public_link',
        id: link.id,
      });
      await stream.waitFor('access_invalidated');
    } finally {
      stream.close();
    }

    await request(testApp.app.getHttpServer())
      .get(`/access/public-links/resolve`)
      .query({ token: link.token })
      .expect(404);
  });

  it('sets anti-buffering headers and sends a ping', async () => {
    const stream = await SseClient.open({
      port,
      cookie: owner.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      expect(String(stream.headers['cache-control'])).toContain('no-transform');
      expect(stream.headers['x-accel-buffering']).toBe('no');
      expect(String(stream.headers['content-type'])).toContain(
        'text/event-stream',
      );
    } finally {
      stream.close();
    }
  });

  it('notifies the owner when a viewer records a file view', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `seen-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
    const stream = await SseClient.open({
      port,
      cookie: owner.cookie,
      dataRoomId: owner.roomId,
    });

    try {
      await stream.waitFor('ping');
      await request(testApp.app.getHttpServer())
        .post(`/files/${file.id}/view`)
        .set('Cookie', viewer.cookie)
        .expect(200);
      const frame = await stream.waitFor('activity_recorded');
      expect(frame.data).toMatchObject({
        type: 'activity_recorded',
        dataRoomId: owner.roomId,
      });
    } finally {
      stream.close();
    }
  });
});
