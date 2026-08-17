import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function createPublicLink(
  app: INestApplication,
  cookie: string,
  input: {
    type: 'data_room' | 'folder' | 'file';
    id: string;
    expiresAt?: string;
  },
): Promise<{ id: string; token: string; type: string; subjectId: string }> {
  const response = await request(app.getHttpServer())
    .post('/access/public-links')
    .set('Cookie', cookie)
    .send(input);

  if (response.status !== 201) {
    throw new Error(
      `create public link failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    id: response.body.id as string,
    token: response.body.token as string,
    type: response.body.type as string,
    subjectId: response.body.subjectId as string,
  };
}

export async function grantAccess(
  app: INestApplication,
  cookie: string,
  input: {
    userId: string;
    role: 'viewer' | 'editor';
    type: 'data_room' | 'folder' | 'file';
    id: string;
    expiresAt?: string;
  },
): Promise<{ id: string }> {
  const response = await request(app.getHttpServer())
    .post('/access/grants')
    .set('Cookie', cookie)
    .send(input);

  if (response.status !== 201) {
    throw new Error(
      `grant failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return { id: response.body.id as string };
}

export async function revokeAccess(
  app: INestApplication,
  cookie: string,
  input: { kind: 'grant' | 'invite' | 'public_link'; id: string },
): Promise<void> {
  const response = await request(app.getHttpServer())
    .post('/access/revoke')
    .set('Cookie', cookie)
    .send(input);

  if (response.status !== 200) {
    throw new Error(
      `revoke failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
}
