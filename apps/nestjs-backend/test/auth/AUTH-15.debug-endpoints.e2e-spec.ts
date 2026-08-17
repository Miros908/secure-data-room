import request from 'supertest';
import { createTestApp, type TestApp } from '../helpers/app';

/**
 * Чек-лист §1 AUTH-15
 * Debug/admin/swagger не торчат. Health не отдаёт секреты.
 */
describe('AUTH-15 debug endpoints are closed', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  it.each(['/docs', '/swagger', '/swagger-ui', '/health'])(
    'GET %s → 404 without secrets',
    async (path) => {
      const response = await request(testApp.app.getHttpServer()).get(path);

      expect(response.status).toBe(404);
      const body = JSON.stringify(response.body).toLowerCase();
      expect(body).not.toContain('postgres://');
      expect(body).not.toContain('r2_secret');
      expect(body).not.toContain('password_hash');
    },
  );
});
