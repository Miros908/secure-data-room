import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(__dirname, '..');

describe('DB-20 raw SQL does not take user values', () => {
  it('src has no $queryRawUnsafe / $executeRawUnsafe', () => {
    const files = walk(SRC_ROOT);

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(`${file}: ${text}`).not.toMatch(
        /\$queryRawUnsafe|\$executeRawUnsafe/,
      );
    }
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
