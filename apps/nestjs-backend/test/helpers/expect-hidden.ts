import type { Response } from 'supertest';

/** ACL-15: чужой ресурс выглядит как несуществующий. */
export function expectHidden(response: Response): void {
  expect(response.status).toBe(404);
  expect(response.body).toMatchObject({ code: 'not_found' });
  expect(response.body).not.toHaveProperty('name');
  expect(response.body).not.toHaveProperty('downloadUrl');
  expect(response.body).not.toHaveProperty('folders');
  expect(response.body).not.toHaveProperty('files');
  expect(response.body).not.toHaveProperty('breadcrumbs');
  expect(response.body).not.toHaveProperty('myRoom');
  expect(response.body).not.toHaveProperty('token');
  expect(response.body).not.toHaveProperty('role');
  expect(response.body).not.toHaveProperty('visitors');
  expect(response.body).not.toHaveProperty('events');
  expect(response.body).not.toHaveProperty('topFiles');
  expect(response.body).not.toHaveProperty('items');
}
