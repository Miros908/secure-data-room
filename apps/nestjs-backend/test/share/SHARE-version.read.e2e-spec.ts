import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  createPublicLink,
  grantAccess,
  revokeAccess,
} from '../helpers/access-client';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  listFileVersions,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';
import { expectHidden } from '../helpers/expect-hidden';

const SECOND_PDF = Buffer.from('%PDF-1.4\n%share-v2\n%%EOF\n');

describe('SHARE file versions', () => {
  let testApp: TestApp;
  let owner: Actor;
  let reader: Actor;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    owner = await registerActor(testApp.app);
    reader = await registerActor(testApp.app);
  });

  it('public token and grant can read current and v1; revoke hides both', async () => {
    const name = `share-${randomUUID()}.pdf`;
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', SECOND_PDF, {
        filename: name,
        contentType: 'application/pdf',
      })
      .expect(200);

    const grant = await grantAccess(testApp.app, owner.cookie, {
      userId: reader.id,
      role: 'viewer',
      type: 'file',
      id: file.id,
    });
    const link = await createPublicLink(testApp.app, owner.cookie, {
      type: 'file',
      id: file.id,
    });
    const versions = await listFileVersions(testApp.app, owner.cookie, file.id);
    const first = versions.find((item) => item.versionNumber === 1);
    expect(first).toBeDefined();

    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', reader.cookie)
      .expect(200);
    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}/versions/${first!.id}`)
      .set('Cookie', reader.cookie)
      .expect(200);
    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}?token=${link.token}`)
      .expect(200);
    await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}/versions/${first!.id}?token=${link.token}`)
      .expect(200);

    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'grant',
      id: grant.id,
    });
    await revokeAccess(testApp.app, owner.cookie, {
      kind: 'public_link',
      id: link.id,
    });

    expectHidden(
      await request(testApp.app.getHttpServer())
        .get(`/files/${file.id}`)
        .set('Cookie', reader.cookie),
    );
    expectHidden(
      await request(testApp.app.getHttpServer()).get(
        `/files/${file.id}/versions/${first!.id}?token=${link.token}`,
      ),
    );
  });
});
