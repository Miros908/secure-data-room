import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DEFAULT_DOWNLOAD_TTL_SECONDS } from '../../src/infrastructure/storage/storage.service';
import { MAX_FILE_BYTES } from '../../src/modules/files/files.constants';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  registerActor,
  uploadPdf,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §4 UP-12, UP-16, UP-17, UP-18, UP-19, UP-21, UP-30, UP-37
 * Размер и PDF проверяются на сервере; лишний DTO не принимается.
 */
describe('UP-12 / 16–19 / 21 / 30 / 37 size, PDF, TTL', () => {
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

  it('UP-12 signed GET TTL is at most 15 minutes', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `ttl-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const before = Date.now();
    const response = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const expires = new Date(
      response.body.downloadUrlExpiresAt as string,
    ).getTime();

    expect(expires).toBeGreaterThan(before);
    expect(expires).toBeLessThanOrEqual(
      before + DEFAULT_DOWNLOAD_TTL_SECONDS * 1000 + 2000,
    );
    expect(DEFAULT_DOWNLOAD_TTL_SECONDS).toBeLessThanOrEqual(15 * 60);
  });

  it('UP-16 size comes from the body; client sizeBytes is rejected', async () => {
    const rejected = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', `size-${randomUUID()}.pdf`)
      .field('sizeBytes', '1')
      .attach('file', MINIMAL_PDF, {
        filename: 'size.pdf',
        contentType: 'application/pdf',
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.code).toBe('validation_error');

    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `size-ok-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const row = await testApp.prisma.files.findUniqueOrThrow({
      where: { id: file.id },
    });
    expect(Number(row.size_bytes)).toBe(MINIMAL_PDF.length);
  });

  it('UP-17 / UP-37 file over MAX_FILE_BYTES is rejected and not listed', async () => {
    const huge = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(MAX_FILE_BYTES, 0x20),
    ]);
    const name = `huge-${randomUUID()}.pdf`;
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .set('Connection', 'close')
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', huge, {
        filename: name,
        contentType: 'application/pdf',
      });

    expect(response.status).not.toBe(201);
    expect(response.status).not.toBe(500);
    expect([400, 413]).toContain(response.status);

    const listing = await request(testApp.app.getHttpServer())
      .get(`/folders?dataRoomId=${owner.roomId}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const names = (listing.body.files as Array<{ name: string }>).map(
      (item) => item.name,
    );
    expect(names).not.toContain(name);
  });

  it('UP-18 / UP-19 Content-Type is not enough: non-PDF bytes are rejected', async () => {
    const name = `fake-${randomUUID()}.pdf`;
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', Buffer.from('not a pdf'), {
        filename: name,
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_file_type');
  });

  it('UP-18 PDF magic is accepted even if the client sends a wrong MIME type', async () => {
    const name = `magic-${randomUUID()}.pdf`;
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', MINIMAL_PDF, {
        filename: name,
        contentType: 'application/octet-stream',
      });

    expect(response.status).toBe(201);
  });

  it('UP-21 garbage after a PDF header does not 500', async () => {
    const junk = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(64 * 1024, 0xff),
    ]);
    const response = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', `junk-${randomUUID()}.pdf`)
      .attach('file', junk, {
        filename: 'junk.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).not.toBe(500);
    expect([201, 400]).toContain(response.status);
  });

  it('UP-30 invalid upload leaves no visible file', async () => {
    const name = `missing-${randomUUID()}.pdf`;
    await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', Buffer.from('nope'), {
        filename: name,
        contentType: 'application/pdf',
      })
      .expect(400);

    const listing = await request(testApp.app.getHttpServer())
      .get(`/folders?dataRoomId=${owner.roomId}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(
      (listing.body.files as Array<{ name: string }>).map((item) => item.name),
    ).not.toContain(name);
  });
});
