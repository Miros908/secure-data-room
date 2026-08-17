import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { PRISMA_INTERACTIVE_TRANSACTION } from './prisma-transaction';

const SRC_ROOT = path.join(__dirname, '..');
const SCHEMA = readFileSync(
  path.join(__dirname, '../../prisma/schema.prisma'),
  'utf8',
);

describe('TX transaction invariants', () => {
  it('TX-01 $transaction files do not call object storage', () => {
    for (const file of walk(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes('$transaction')) {
        continue;
      }

      expect(`${file}: ${text}`).not.toMatch(
        /STORAGE_SERVICE|storage\.put|storage\.delete|getDownloadUrl/,
      );
    }
  });

  it('TX-20 interactive transactions set maxWait and timeout', () => {
    expect(PRISMA_INTERACTIVE_TRANSACTION.maxWait).toBe(2_000);
    expect(PRISMA_INTERACTIVE_TRANSACTION.timeout).toBe(5_000);

    for (const file of walk(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes('$transaction')) {
        continue;
      }

      expect(text).toContain('PRISMA_INTERACTIVE_TRANSACTION');
    }
  });

  it('TX-22 schema has no cached counter columns', () => {
    expect(SCHEMA).not.toMatch(/file_count|folder_count|cached_/);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (entry === 'generated' || entry === 'node_modules') {
      return [];
    }
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}
