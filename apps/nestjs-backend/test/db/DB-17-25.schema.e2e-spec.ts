import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../helpers/app';
import { registerActor, uploadPdf, type Actor } from '../helpers/drive-client';

/**
 * Чек-лист §5 DB-17, DB-22, DB-23, DB-25
 */
describe('DB-17 / 22 / 23 / 25 bigint, migrations, owner restrict', () => {
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

  it('DB-17 sizeBytes is a JSON number, not a bigint string', async () => {
    const file = await uploadPdf(testApp.app, owner.cookie, {
      name: `size-${randomUUID()}.pdf`,
      dataRoomId: owner.roomId,
    });
    const response = await request(testApp.app.getHttpServer())
      .get(`/files/${file.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(typeof response.body.sizeBytes).toBe('number');
    expect(Number.isInteger(response.body.sizeBytes)).toBe(true);
  });

  it('DB-22 / DB-23 applied migrations match the repo set', async () => {
    const rows = await testApp.prisma.$queryRaw<
      Array<{ migration_name: string; rolled_back_at: Date | null }>
    >`SELECT migration_name, rolled_back_at FROM _prisma_migrations ORDER BY finished_at`;

    expect(rows.every((row) => row.rolled_back_at === null)).toBe(true);
    expect(rows.map((row) => row.migration_name)).toEqual([
      '20260817000100_init',
      '20260817000200_check_constraints',
      '20260817000300_search_trgm',
    ]);
  });

  it('DB-25 deleting the owner is restricted while the room exists', async () => {
    await expect(
      testApp.prisma.users.delete({ where: { id: owner.id } }),
    ).rejects.toThrow();

    const room = await testApp.prisma.data_rooms.findUniqueOrThrow({
      where: { id: owner.roomId },
    });
    expect(room.owner_id).toBe(owner.id);
  });
});
