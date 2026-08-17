import { readFileSync } from 'node:fs';
import path from 'node:path';

const SEARCH_REPO = readFileSync(
  path.join(__dirname, '../modules/search/search.repository.ts'),
  'utf8',
);
const LISTING = readFileSync(
  path.join(
    __dirname,
    '../modules/folders/services/list-folder-contents.service.ts',
  ),
  'utf8',
);

describe('PERF-09 search is a separate limited query', () => {
  it('search SQL uses LIMIT, ESCAPE and no OFFSET', () => {
    expect(SEARCH_REPO).toMatch(/ILIKE/);
    expect(SEARCH_REPO).toMatch(/ESCAPE/);
    expect(SEARCH_REPO).toMatch(/LIMIT/);
    expect(SEARCH_REPO).not.toMatch(/\bOFFSET\b/i);
    expect(SEARCH_REPO).not.toMatch(/\bskip\s*:/i);
  });

  it('folder listing still does not search', () => {
    expect(LISTING).not.toMatch(/ILIKE/i);
    expect(LISTING).not.toContain('searchHits');
  });
});
