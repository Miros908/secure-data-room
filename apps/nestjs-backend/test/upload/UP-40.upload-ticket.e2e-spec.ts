import { uploadTicketResponseSchema } from '@sdr/shared/files';
import request from 'supertest';
import { UPLOAD_TICKET_HEADER } from '../../src/modules/auth/utils/upload-ticket';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { MINIMAL_PDF, registerActor, uploadPdf } from '../helpers/drive-client';

describe('upload ticket for cross-origin file bytes', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
  });

  it('issues a ticket and accepts POST /files with the header instead of a cookie', async () => {
    const owner = await registerActor(testApp.app);
    const ticketResponse = await request(testApp.app.getHttpServer())
      .post('/files/upload-ticket')
      .set('Cookie', owner.cookie)
      .expect(201);
    const { ticket, expiresAt } = uploadTicketResponseSchema.parse(
      ticketResponse.body,
    );

    expect(ticket.length).toBeGreaterThan(0);
    expect(expiresAt).toEqual(expect.any(String));

    const uploaded = await request(testApp.app.getHttpServer())
      .post('/files')
      .set(UPLOAD_TICKET_HEADER, ticket)
      .field('dataRoomId', owner.roomId)
      .field('name', 'ticket.pdf')
      .attach('file', MINIMAL_PDF, {
        filename: 'ticket.pdf',
        contentType: 'application/pdf',
      });

    expect(uploaded.status).toBe(201);
    expect(uploaded.body).toEqual(
      expect.objectContaining({ name: 'ticket.pdf' }),
    );
  });

  it('rejects upload without a cookie or ticket', async () => {
    const owner = await registerActor(testApp.app);

    await request(testApp.app.getHttpServer())
      .post('/files')
      .field('dataRoomId', owner.roomId)
      .field('name', 'no-auth.pdf')
      .attach('file', MINIMAL_PDF, {
        filename: 'no-auth.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);
  });

  it('does not treat an upload ticket as a general session', async () => {
    const owner = await registerActor(testApp.app);
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: 'keep.pdf',
      dataRoomId: owner.roomId,
    });
    const ticketResponse = await request(testApp.app.getHttpServer())
      .post('/files/upload-ticket')
      .set('Cookie', owner.cookie)
      .expect(201);
    const { ticket } = uploadTicketResponseSchema.parse(ticketResponse.body);

    await request(testApp.app.getHttpServer())
      .delete(`/files/${file.id}`)
      .set(UPLOAD_TICKET_HEADER, ticket)
      .expect(401);
  });
});
