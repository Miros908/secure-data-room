import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/auth.constants';

export const TEST_PASSWORD = 'TestPass-12';
export const TEST_FRONTEND_ORIGIN =
  process.env.CORS_ORIGIN ?? 'http://localhost:3000';
export const EVIL_ORIGIN = 'https://evil.example';

export type RegisteredSession = {
  id: string;
  email: string;
  name: string;
  password: string;
  cookie: string;
};

export function sessionCookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const session = cookies.find((value) =>
    value.startsWith(`${SESSION_COOKIE_NAME}=`),
  );

  if (!session) {
    throw new Error('Set-Cookie did not include a session cookie');
  }

  return session.split(';')[0];
}

export async function registerSession(
  app: INestApplication,
  input?: { email?: string; password?: string; name?: string },
): Promise<RegisteredSession> {
  const email = input?.email ?? `auth-${randomUUID()}@example.test`;
  const password = input?.password ?? TEST_PASSWORD;
  const name = input?.name ?? 'Test User';

  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name });

  if (response.status !== 201) {
    throw new Error(
      `register failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return {
    id: response.body.id as string,
    email: response.body.email as string,
    name: response.body.name as string,
    password,
    cookie: sessionCookieFrom(response),
  };
}

export async function loginSession(
  app: INestApplication,
  input: { email: string; password: string },
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: input.email, password: input.password });

  if (response.status !== 200) {
    throw new Error(
      `login failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }

  return sessionCookieFrom(response);
}
