import { describe, expect, it } from 'vitest';
import { matchesDriveQuery, sortDriveEntries } from '@/app/(pages)/drive/components/drive-sort';

describe('drive-sort', () => {
  it('matchesDriveQuery is a client filter for already loaded lists', () => {
    expect(matchesDriveQuery('Term Sheet.pdf', 'term')).toBe(true);
    expect(matchesDriveQuery('Term Sheet.pdf', '  TERM  ')).toBe(true);
    expect(matchesDriveQuery('Term Sheet.pdf', 'budget')).toBe(false);
    expect(matchesDriveQuery('Term Sheet.pdf', '')).toBe(true);
  });

  it('sortDriveEntries orders by name with numeric awareness', () => {
    const items = [
      { name: 'File 10', createdAt: '2026-01-02T00:00:00.000Z' },
      { name: 'File 2', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    expect(sortDriveEntries(items, 'name', 'asc').map((item) => item.name)).toEqual(
      ['File 2', 'File 10'],
    );
  });
});
