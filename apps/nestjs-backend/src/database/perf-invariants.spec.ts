import { readFileSync } from 'node:fs';
import path from 'node:path';

const LISTING = readFileSync(
  path.join(
    __dirname,
    '../modules/folders/services/list-folder-contents.service.ts',
  ),
  'utf8',
);
const FOLDERS_REPO = readFileSync(
  path.join(__dirname, '../modules/folders/folders.repository.ts'),
  'utf8',
);
const INIT = readFileSync(
  path.join(
    __dirname,
    '../../prisma/migrations/20260817000100_init/migration.sql',
  ),
  'utf8',
);
const SRC_TREE = [
  LISTING,
  FOLDERS_REPO,
  readFileSync(
    path.join(__dirname, '../modules/files/files.repository.ts'),
    'utf8',
  ),
].join('\n');

describe('PERF listing does not load the whole tree', () => {
  it('PERF-01 / PERF-03 children are queried by parent, not OFFSET', () => {
    expect(FOLDERS_REPO).toContain('parent_id: params.parentId');
    expect(FOLDERS_REPO).toContain('folder_id: params.folderId');
    expect(FOLDERS_REPO).toContain("orderBy: [{ name: 'asc' }, { id: 'asc' }]");
    expect(SRC_TREE).not.toMatch(/\boffset:\s*/);
    expect(SRC_TREE).not.toMatch(/\bskip:\s*/);
  });

  it('PERF-02 listing service never walks descendants', () => {
    expect(LISTING).not.toContain('countSubtree');
    expect(LISTING).not.toContain('startsWith: folder.path');
  });

  it('PERF-05 / DB-24 indexes match parent + name + id (no deletedAt)', () => {
    expect(INIT).toContain(
      'CREATE INDEX "folders_data_room_id_parent_id_name_id_idx"',
    );
    expect(INIT).toContain(
      'CREATE INDEX "files_data_room_id_folder_id_name_id_idx"',
    );
    expect(INIT).not.toContain('deleted_at');
  });

  it('PERF-06 / PERF-07 / PERF-08 no listing totals, CTE or ILIKE search', () => {
    expect(LISTING).not.toContain('countSubtree');
    expect(SRC_TREE).not.toMatch(/WITH RECURSIVE|ILIKE /i);
  });
});
