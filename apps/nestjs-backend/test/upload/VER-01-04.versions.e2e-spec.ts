import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  listFileVersions,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

const SECOND_PDF = Buffer.from('%PDF-1.4\n%version-two\n%%EOF\n');

describe('file versions', () => {
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

  it('two uploads of the same name keep one file and two versions', async () => {
    const name = `report-${randomUUID()}.pdf`;
    const first = await uploadPdf(testApp.app, owner.cookie, {
      name,
      dataRoomId: owner.roomId,
    });
    const second = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', SECOND_PDF, {
        filename: name,
        contentType: 'application/pdf',
      })
      .expect(200);

    expect(second.body.id).toBe(first.id);
    expect(second.body.isNewVersion).toBe(true);
    expect(second.body.versionNumber).toBe(2);
    expect(second.body.versionCount).toBe(2);

    const files = await testApp.prisma.files.findMany({
      where: { data_room_id: owner.roomId, name },
    });
    expect(files).toHaveLength(1);

    const listing = await request(testApp.app.getHttpServer())
      .get(`/folders?dataRoomId=${owner.roomId}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const listed = listing.body.files.filter(
      (file: { name: string }) => file.name === name,
    );
    expect(listed).toHaveLength(1);
    expect(listed[0].versionCount).toBe(2);
    expect(listed[0].sizeBytes).toBe(SECOND_PDF.length);
  });

  it('GET current is v2 and GET v1 still returns the first object', async () => {
    const name = `rev-${randomUUID()}.pdf`;
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

    const current = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(current.body.versionNumber).toBe(2);
    expect(current.body.sizeBytes).toBe(SECOND_PDF.length);

    const versions = await listFileVersions(testApp.app, owner.cookie, file.id);
    expect(versions.map((item) => item.versionNumber)).toEqual([2, 1]);
    const firstVersion = versions.find((item) => item.versionNumber === 1);
    expect(firstVersion).toBeDefined();

    const old = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}/versions/${firstVersion!.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(old.body.versionNumber).toBe(1);
    expect(old.body.sizeBytes).toBe(MINIMAL_PDF.length);
    expect(old.body.downloadUrl).not.toBe(current.body.downloadUrl);
    expect(old.body.currentVersionId).toBe(current.body.currentVersionId);
  });

  it('rename does not change version storage keys', async () => {
    const name = `keep-${randomUUID()}.pdf`;
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
    const before = await testApp.prisma.file_versions.findMany({
      where: { file_id: file.id },
      orderBy: { version_number: 'asc' },
    });

    await request(testApp.app.getHttpServer())
      .patch(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .send({ name: `renamed-${randomUUID()}.pdf` })
      .expect(200);

    const after = await testApp.prisma.file_versions.findMany({
      where: { file_id: file.id },
      orderBy: { version_number: 'asc' },
    });
    expect(after.map((row) => row.storage_key)).toEqual(
      before.map((row) => row.storage_key),
    );
  });

  it('GET a version from another file is 404', async () => {
    const first = await uploadPdf(testApp.app, owner.cookie, {
      name: `a-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const second = await uploadPdf(testApp.app, owner.cookie, {
      name: `b-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const otherVersion = await testApp.prisma.file_versions.findFirstOrThrow({
      where: { file_id: second.id },
    });

    await request(testApp.app.getHttpServer())
      .get(`/files/${first.id}/versions/${otherVersion.id}`)
      .set('Cookie', owner.cookie)
      .expect(404);
  });
});
