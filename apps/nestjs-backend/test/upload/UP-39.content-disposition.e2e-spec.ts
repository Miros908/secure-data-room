import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import {
  MINIMAL_PDF,
  registerActor,
  type Actor,
} from '../helpers/drive-client';

/**
 * Чек-лист §4 UP-39
 * Content-Disposition кодирует имя и не допускает CRLF.
 */
describe('UP-39 Content-Disposition is safe', () => {
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

  it('download header has no CR/LF and carries filename*', async () => {
    const name = `Договор ${randomUUID()}.pdf`;
    const uploaded = await request(testApp.app.getHttpServer())
      .post('/files')
      .set('Cookie', owner.cookie)
      .field('dataRoomId', owner.roomId)
      .field('name', name)
      .attach('file', MINIMAL_PDF, {
        filename: name,
        contentType: 'application/pdf',
      })
      .expect(201);

    const detail = await request(testApp.app.getHttpServer())
      .get(`/files/${uploaded.body.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const parsed = new URL(
      detail.body.downloadUrl as string,
      'http://localhost:4000',
    );
    const download = await request(testApp.app.getHttpServer())
      .get(`${parsed.pathname}${parsed.search}`)
      .expect(200);

    const header = String(download.headers['content-disposition'] ?? '');
    expect(header).not.toMatch(/\r|\n/);
    expect(header.toLowerCase()).toContain('inline');
    expect(header).toContain('filename*=');
  });
});
