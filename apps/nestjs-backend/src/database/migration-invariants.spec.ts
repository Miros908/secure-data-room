import { readFileSync } from 'node:fs';
import path from 'node:path';

const INIT = readFileSync(
  path.join(
    __dirname,
    '../../prisma/migrations/20260817000100_init/migration.sql',
  ),
  'utf8',
);
const CHECKS = readFileSync(
  path.join(
    __dirname,
    '../../prisma/migrations/20260817000200_check_constraints/migration.sql',
  ),
  'utf8',
);

describe('DB migrations encode tree and share invariants', () => {
  it('composite FK keeps folder/file in the same room as parent', () => {
    expect(INIT).toContain(
      'FOREIGN KEY ("parent_id", "data_room_id") REFERENCES "folders"("id", "data_room_id")',
    );
    expect(INIT).toContain(
      'FOREIGN KEY ("folder_id", "data_room_id") REFERENCES "folders"("id", "data_room_id")',
    );
  });

  it('partial unique indexes exist for NULL parent/folder and active shares', () => {
    expect(INIT).toContain(
      'CREATE UNIQUE INDEX "folders_root_name_key" ON "folders"("data_room_id", "name") WHERE (parent_id IS NULL)',
    );
    expect(INIT).toContain(
      'CREATE UNIQUE INDEX "folders_parent_name_key" ON "folders"("parent_id", "name") WHERE (parent_id IS NOT NULL)',
    );
    expect(INIT).toContain(
      'CREATE UNIQUE INDEX "files_root_name_key" ON "files"("data_room_id", "name") WHERE (folder_id IS NULL)',
    );
    expect(INIT).toContain(
      'CREATE UNIQUE INDEX "access_grants_user_room_active_key"',
    );
    expect(INIT).toContain(
      'WHERE (folder_id IS NULL AND file_id IS NULL AND revoked_at IS NULL)',
    );
  });

  it('CHECK constraints live in the second migration', () => {
    expect(CHECKS).toContain('folders_no_self_parent_check');
    expect(CHECKS).toContain('access_grants_single_target_check');
    expect(CHECKS).toContain('access_invitations_single_target_check');
    expect(CHECKS).toContain('public_share_links_single_target_check');
    expect(CHECKS).toContain('file_versions_storage_key_not_empty_check');
    expect(CHECKS).toContain('file_versions_number_positive_check');
    expect(CHECKS).toContain('files_current_version_same_file_fk');
  });

  it('storage_key is unique; size is bigint; owner delete is restricted', () => {
    expect(INIT).toContain(
      'CREATE UNIQUE INDEX "file_versions_storage_key_key"',
    );
    expect(INIT).toContain(
      'CREATE UNIQUE INDEX "file_versions_file_number_key"',
    );
    expect(INIT).toContain('"size_bytes" BIGINT NOT NULL');
    expect(INIT).toContain(
      'FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT',
    );
  });

  it('timestamps are timestamptz; expiry is not in unique indexes', () => {
    expect(INIT).toContain('"created_at" TIMESTAMPTZ NOT NULL');
    expect(INIT).toContain('"expires_at" TIMESTAMPTZ');
    expect(INIT).toContain('"access_expires_at" TIMESTAMPTZ');
    expect(INIT).not.toMatch(/WHERE[\s\S]*now\(\)/);
  });

  it('activity_events is append-only and does not cascade from files', () => {
    expect(INIT).toContain('CREATE TABLE "activity_events"');
    expect(INIT).toContain('ON DELETE RESTRICT');
    expect(INIT).toContain('ON DELETE SET NULL');
    expect(INIT).toContain(
      'CREATE INDEX "activity_events_data_room_id_created_at_id_idx"',
    );
    expect(INIT).not.toContain('activity_events_file_id_fkey');
    expect(INIT).not.toContain('activity_events_folder_id_fkey');
  });

  it('listing indexes match WHERE + ORDER BY name, id', () => {
    expect(INIT).toContain(
      'CREATE INDEX "folders_data_room_id_parent_id_name_id_idx"',
    );
    expect(INIT).toContain(
      'CREATE INDEX "files_data_room_id_folder_id_name_id_idx"',
    );
  });

  it('search uses pg_trgm gin indexes, not listing btree', () => {
    const search = readFileSync(
      path.join(
        __dirname,
        '../../prisma/migrations/20260817000300_search_trgm/migration.sql',
      ),
      'utf8',
    );
    expect(search).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    expect(search).toContain('gin_trgm_ops');
    expect(search).toContain('files_name_trgm_idx');
    expect(search).toContain('folders_name_trgm_idx');
  });
});
