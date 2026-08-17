import type { INestApplication } from '@nestjs/common';
import type { RegisteredSession } from './auth-client';
import { registerSession } from './auth-client';
import request from 'supertest';

export const MINIMAL_PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

export type Actor = RegisteredSession & {
  roomId: string;
};

export type TestFolder = {
  id: string;
  name: string;
  dataRoomId: string;
};

export type TestFile = {
  id: string;
  name: string;
  dataRoomId: string;
  folderId: string | null;
};

export async function registerActor(app: INestApplication): Promise<Actor> {
  const session = await registerSession(app);
  const room = await getMyRoom(app, session.cookie);

  return { ...session, roomId: room.id };
}

export async function getMyRoom(
  app: INestApplication,
  cookie: string,
): Promise<{ id: string; name: string }> {
  const response = await request(app.getHttpServer())
    .get('/data-rooms')
    .set('Cookie', cookie);

  if (response.status !== 200 || !response.body.myRoom?.id) {
    throw new Error(
      `get data-rooms failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    id: response.body.myRoom.id as string,
    name: response.body.myRoom.name as string,
  };
}

export async function createFolder(
  app: INestApplication,
  cookie: string,
  input: { name: string; dataRoomId: string; parentId?: string },
): Promise<TestFolder> {
  const response = await request(app.getHttpServer())
    .post('/folders')
    .set('Cookie', cookie)
    .send(input);

  if (response.status !== 201) {
    throw new Error(
      `create folder failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    id: response.body.id as string,
    name: response.body.name as string,
    dataRoomId: response.body.dataRoomId as string,
  };
}

export async function uploadPdf(
  app: INestApplication,
  cookie: string,
  input: { name: string; dataRoomId: string; folderId?: string },
): Promise<TestFile> {
  const call = request(app.getHttpServer())
    .post('/files')
    .set('Cookie', cookie)
    .field('dataRoomId', input.dataRoomId)
    .field('name', input.name);

  if (input.folderId) {
    call.field('folderId', input.folderId);
  }

  const response = await call.attach('file', MINIMAL_PDF, {
    filename: input.name,
    contentType: 'application/pdf',
  });

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(
      `upload failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    id: response.body.id as string,
    name: response.body.name as string,
    dataRoomId: response.body.dataRoomId as string,
    folderId: (response.body.folderId as string | null) ?? null,
  };
}

export async function listFileVersions(
  app: INestApplication,
  cookie: string,
  fileId: string,
  token?: string,
): Promise<Array<{ id: string; versionNumber: number }>> {
  const call = request(app.getHttpServer()).get(`/files/${fileId}/versions`);
  if (token) {
    call.query({ token });
  } else {
    call.set('Cookie', cookie);
  }
  const response = await call;
  if (response.status !== 200) {
    throw new Error(
      `list versions failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return response.body.versions as Array<{ id: string; versionNumber: number }>;
}
