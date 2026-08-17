import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { grantAccess } from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

describe('ACL file version write/read', () => {
  let testApp: TestApp;
  let owner: Actor;
  let editor: Actor;
  let viewer: Actor;
  let stranger: Actor;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    editor = await registerActor(testApp.app);
    viewer = await registerActor(testApp.app);
    stranger = await registerActor(testApp.app);
  });

  it('editor can append a version; viewer cannot; stranger is hidden', async () => {
    const name = `acl-${randomUUID()}.pdf`;
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: editor.id,
      role: 'editor',
      type: 'file',
      id: file.id,
    });
    await grantAccess(testApp.app, owner.cookie, {
      userId: viewer.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });

    const asEditor = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', editor.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', MINIMAL_PDF, {
        filename: name,
        contentType: 'application/pdf',
      });
    expect(asEditor.status).toBe(200);
    expect(asEditor.body.id).toBe(file.id);
    expect(asEditor.body.versionNumber).toBe(2);

    const asViewer = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', viewer.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', MINIMAL_PDF, {
        filename: name,
        contentType: 'application/pdf',
      });
    expect(asViewer.status).toBe(403);
    expect(asViewer.body.code).toBe('forbidden');

    const versions = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}/versions`)
      .set('Cookie', viewer.cookie)
      .expect(200);
    expect(versions.body.versions).toHaveLength(2);

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/files/${file.id}/versions`)
        .set('Cookie', stranger.cookie),
    );
  });
});
