import { expect, test, type APIResponse, type Browser, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SAMPLE_PDF, uniqueEmail } from './helpers';
import { API_ORIGIN, TEST_PASSWORD, WEB_ORIGIN } from './ports';

const MINIMAL_PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const JUNK = Buffer.from('this is not a pdf');
const EMPTY = Buffer.alloc(0);
const POLYGLOT = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.from('<html><script>alert(1)</script></html>\n'),
]);

const tmpDir = path.join(os.tmpdir(), `sdr-cto-${Date.now()}`);

test.beforeAll(() => {
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(path.join(tmpDir, 'note.txt'), JUNK);
  writeFileSync(path.join(tmpDir, 'empty.pdf'), EMPTY);
  writeFileSync(path.join(tmpDir, 'polyglot.pdf'), POLYGLOT);
  writeFileSync(path.join(tmpDir, 'ok.pdf'), MINIMAL_PDF);
});

test.afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

test('A — stranger gets 404 with no metadata', async ({ browser }) => {
  const owner = await openSession(browser, 'Owner');
  const stranger = await openSession(browser, 'Stranger');
  const folder = await createFolder(owner.page, owner.roomId, 'secret');
  const file = await uploadPdf(owner.page, owner.roomId, 'deal.pdf', folder.id);

  await expectHidden(
    await stranger.page.request.get(`${API_ORIGIN}/data-rooms/${owner.roomId}`),
  );
  await expectHidden(
    await stranger.page.request.get(
      `${API_ORIGIN}/folders?dataRoomId=${owner.roomId}`,
    ),
  );
  await expectHidden(
    await stranger.page.request.get(`${API_ORIGIN}/folders/${folder.id}`),
  );
  await expectHidden(
    await stranger.page.request.get(`${API_ORIGIN}/files/${file.id}`),
  );
  await expectHidden(
    await stranger.page.request.get(
      `${API_ORIGIN}/data-rooms/${owner.roomId}/activity`,
    ),
  );

  await stranger.page.goto(`/drive?fileId=${file.id}`);
  await expect(stranger.page.getByText('File not found')).toBeVisible();

  await owner.context.close();
  await stranger.context.close();
});

test('B — file link does not open the room and cannot write', async ({
  browser,
}) => {
  const owner = await openSession(browser, 'Owner');
  const folder = await createFolder(owner.page, owner.roomId, 'vault');
  const file = await uploadPdf(owner.page, owner.roomId, 'nda.pdf', folder.id);
  const sibling = await uploadPdf(
    owner.page,
    owner.roomId,
    'other.pdf',
    folder.id,
  );
  const link = await createPublicLink(owner.page, 'file', file.id);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();

  const allowed = await guestPage.request.get(
    `${API_ORIGIN}/files/${file.id}?token=${link.token}`,
  );
  expect(allowed.status()).toBe(200);
  expect((await allowed.json()).downloadUrl).toEqual(expect.any(String));

  await expectHidden(
    await guestPage.request.get(
      `${API_ORIGIN}/folders/${folder.id}?token=${link.token}`,
    ),
  );
  await expectHidden(
    await guestPage.request.get(
      `${API_ORIGIN}/folders?dataRoomId=${owner.roomId}&token=${link.token}`,
    ),
  );
  await expectHidden(
    await guestPage.request.get(
      `${API_ORIGIN}/files/${sibling.id}?token=${link.token}`,
    ),
  );

  const write = await guestPage.request.post(`${API_ORIGIN}/files`, {
    headers: { Origin: WEB_ORIGIN },
    multipart: {
      dataRoomId: owner.roomId,
      folderId: folder.id,
      name: 'pwn.pdf',
      file: {
        name: 'pwn.pdf',
        mimeType: 'application/pdf',
        buffer: MINIMAL_PDF,
      },
    },
  });
  expect(write.status()).toBe(401);

  await guest.close();
  await owner.context.close();
});

test('C — revoke blocks new URLs; already signed GET still serves', async ({
  browser,
}) => {
  const owner = await openSession(browser, 'Owner');
  const file = await uploadPdf(owner.page, owner.roomId, 'term.pdf');
  const link = await createPublicLink(owner.page, 'file', file.id);

  const before = await owner.page.request.get(
    `${API_ORIGIN}/files/${file.id}?token=${link.token}`,
  );
  expect(before.status()).toBe(200);
  const { downloadUrl } = (await before.json()) as { downloadUrl: string };
  expect(downloadUrl).toContain('/storage/objects');

  const bytesBefore = await owner.page.request.get(downloadUrl);
  expect(bytesBefore.status()).toBe(200);
  expect(await bytesBefore.body()).toEqual(MINIMAL_PDF);

  const revoked = await owner.page.request.post(`${API_ORIGIN}/access/revoke`, {
    headers: { Origin: WEB_ORIGIN },
    data: { kind: 'public_link', id: link.id },
  });
  expect(revoked.status(), await revoked.text()).toBe(200);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();

  await expectHidden(
    await guestPage.request.get(
      `${API_ORIGIN}/files/${file.id}?token=${link.token}`,
    ),
  );

  const bytesAfter = await guestPage.request.get(downloadUrl);
  expect(
    bytesAfter.status(),
    'known limit: signed URL lives until TTL after revoke',
  ).toBe(200);
  expect(await bytesAfter.body()).toEqual(MINIMAL_PDF);

  await guest.close();
  await owner.context.close();
});

test('D — UI is viewer-only; API editor can write; public token cannot', async ({
  browser,
}) => {
  const owner = await openSession(browser, 'Owner');
  const peer = await openSession(browser, 'Peer');
  const folder = await createFolder(owner.page, owner.roomId, 'shared');

  const grant = await owner.page.request.post(`${API_ORIGIN}/access/grants`, {
    headers: { Origin: WEB_ORIGIN },
    data: {
      userId: peer.id,
      role: 'editor',
      type: 'folder',
      id: folder.id,
    },
  });
  expect(grant.status(), await grant.text()).toBe(201);
  expect((await grant.json()).role).toBe('editor');

  const uploaded = await uploadPdf(
    peer.page,
    owner.roomId,
    'from-editor.pdf',
    folder.id,
  );
  expect(uploaded.id).toBeTruthy();

  const link = await createPublicLink(owner.page, 'folder', folder.id);
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  const publicWrite = await guestPage.request.post(`${API_ORIGIN}/files`, {
    headers: { Origin: WEB_ORIGIN },
    multipart: {
      dataRoomId: owner.roomId,
      folderId: folder.id,
      name: 'from-link.pdf',
      file: {
        name: 'from-link.pdf',
        mimeType: 'application/pdf',
        buffer: MINIMAL_PDF,
      },
    },
  });
  expect(publicWrite.status()).toBe(401);

  const publicWriteWithToken = await guestPage.request.post(
    `${API_ORIGIN}/files?token=${link.token}`,
    {
      headers: { Origin: WEB_ORIGIN },
      multipart: {
        dataRoomId: owner.roomId,
        folderId: folder.id,
        name: 'from-link.pdf',
        file: {
          name: 'from-link.pdf',
          mimeType: 'application/pdf',
          buffer: MINIMAL_PDF,
        },
      },
    },
  );
  expect(publicWriteWithToken.status()).toBe(401);

  await guest.close();
  await owner.context.close();
  await peer.context.close();
});

test('E — non-PDF and empty rejected; polyglot with %PDF is stored', async ({
  browser,
}) => {
  const owner = await openSession(browser, 'Owner');

  const junk = await owner.page.request.post(`${API_ORIGIN}/files`, {
    headers: { Origin: WEB_ORIGIN },
    multipart: {
      dataRoomId: owner.roomId,
      name: 'note.txt',
      file: {
        name: 'note.txt',
        mimeType: 'text/plain',
        buffer: readFileSync(path.join(tmpDir, 'note.txt')),
      },
    },
  });
  expect(junk.status()).toBe(400);
  expect(await junk.json()).toMatchObject({ code: 'invalid_file_type' });

  const empty = await owner.page.request.post(`${API_ORIGIN}/files`, {
    headers: { Origin: WEB_ORIGIN },
    multipart: {
      dataRoomId: owner.roomId,
      name: 'empty.pdf',
      file: {
        name: 'empty.pdf',
        mimeType: 'application/pdf',
        buffer: EMPTY,
      },
    },
  });
  expect(empty.status()).toBe(400);

  const polyglot = await uploadNamed(
    owner.page,
    owner.roomId,
    'polyglot.pdf',
    POLYGLOT,
  );
  expect(
    polyglot.status(),
    'known limit: only first four bytes are checked',
  ).toBe(201);

  const real = await uploadNamed(
    owner.page,
    owner.roomId,
    'sample.pdf',
    readFileSync(SAMPLE_PDF),
  );
  expect(real.status()).toBe(201);
  const detail = await owner.page.request.get(
    `${API_ORIGIN}/files/${(await real.json()).id}`,
  );
  const { downloadUrl } = (await detail.json()) as { downloadUrl: string };
  const downloaded = await owner.page.request.get(downloadUrl);
  const bytes = await downloaded.body();
  expect(bytes.equals(readFileSync(SAMPLE_PDF))).toBe(true);
  expect(bytes.toString('utf8')).not.toContain(owner.email);

  await owner.context.close();
});

test('F — deleted folder is 404 for owner and guest', async ({ browser }) => {
  const owner = await openSession(browser, 'Owner');
  const folder = await createFolder(owner.page, owner.roomId, 'gone');
  const file = await uploadPdf(owner.page, owner.roomId, 'inside.pdf', folder.id);
  const link = await createPublicLink(owner.page, 'folder', folder.id);

  const removed = await owner.page.request.delete(
    `${API_ORIGIN}/folders/${folder.id}`,
    { headers: { Origin: WEB_ORIGIN } },
  );
  expect(removed.status()).toBe(200);

  await expectHidden(
    await owner.page.request.get(`${API_ORIGIN}/folders/${folder.id}`),
  );
  await expectHidden(
    await owner.page.request.get(`${API_ORIGIN}/files/${file.id}`),
  );
  await expectHidden(
    await owner.page.request.get(
      `${API_ORIGIN}/folders/${folder.id}?token=${link.token}`,
    ),
  );

  await owner.context.close();
});

test('G — foreign Origin is 403; missing Origin still mutates', async ({
  browser,
}) => {
  const owner = await openSession(browser, 'Owner');

  const csrf = await owner.page.request.post(`${API_ORIGIN}/auth/logout`, {
    headers: { Origin: 'https://evil.example' },
  });
  expect(csrf.status()).toBe(403);
  const stillIn = await owner.page.request.get(`${API_ORIGIN}/auth/me`);
  expect(stillIn.status()).toBe(200);

  const noOrigin = await owner.page.request.post(`${API_ORIGIN}/auth/logout`);
  expect(
    noOrigin.status(),
    'known limit: CSRF guard allows requests with no Origin',
  ).toBe(200);
  const after = await owner.page.request.get(`${API_ORIGIN}/auth/me`);
  expect(after.status()).toBe(401);

  await owner.context.close();
});

type Session = {
  page: Page;
  context: Awaited<ReturnType<Browser['newContext']>>;
  email: string;
  id: string;
  roomId: string;
};

async function openSession(browser: Browser, name: string): Promise<Session> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail();
  const register = await page.request.post(`${API_ORIGIN}/auth/register`, {
    headers: { Origin: WEB_ORIGIN },
    data: { email, password: TEST_PASSWORD, name },
  });
  expect(register.ok(), await register.text()).toBeTruthy();
  const user = (await register.json()) as { id: string; email: string };
  const rooms = await page.request.get(`${API_ORIGIN}/data-rooms`);
  expect(rooms.ok(), await rooms.text()).toBeTruthy();
  const body = (await rooms.json()) as { myRoom: { id: string } };
  return {
    page,
    context,
    email: user.email,
    id: user.id,
    roomId: body.myRoom.id,
  };
}

async function createFolder(page: Page, dataRoomId: string, name: string) {
  const response = await page.request.post(`${API_ORIGIN}/folders`, {
    headers: { Origin: WEB_ORIGIN },
    data: { dataRoomId, name },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string };
}

async function uploadPdf(
  page: Page,
  dataRoomId: string,
  name: string,
  folderId?: string,
) {
  const response = await uploadNamed(
    page,
    dataRoomId,
    name,
    MINIMAL_PDF,
    folderId,
  );
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string };
}

async function uploadNamed(
  page: Page,
  dataRoomId: string,
  name: string,
  buffer: Buffer,
  folderId?: string,
) {
  const multipart: Record<
    string,
    string | { name: string; mimeType: string; buffer: Buffer }
  > = {
    dataRoomId,
    name,
    file: { name, mimeType: 'application/pdf', buffer },
  };
  if (folderId) {
    multipart.folderId = folderId;
  }
  return page.request.post(`${API_ORIGIN}/files`, {
    headers: { Origin: WEB_ORIGIN },
    multipart,
  });
}

async function createPublicLink(
  page: Page,
  type: 'file' | 'folder' | 'data_room',
  id: string,
) {
  const response = await page.request.post(`${API_ORIGIN}/access/public-links`, {
    headers: { Origin: WEB_ORIGIN },
    data: { type, id },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string; token: string };
}

async function expectHidden(response: APIResponse) {
  expect(response.status()).toBe(404);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.code).toBe('not_found');
  expect(body).not.toHaveProperty('downloadUrl');
  expect(body).not.toHaveProperty('folders');
  expect(body).not.toHaveProperty('files');
  expect(body).not.toHaveProperty('token');
  expect(body).not.toHaveProperty('myRoom');
}
