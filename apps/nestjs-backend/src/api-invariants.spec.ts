import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(__dirname);
const MAIN = readFileSync(path.join(__dirname, 'main.ts'), 'utf8');
const LISTING = readFileSync(
  path.join(
    __dirname,
    'modules/folders/services/list-folder-contents.service.ts',
  ),
  'utf8',
);

describe('API source invariants', () => {
  it('API-02 Prisma create/update does not spread a client dto', () => {
    for (const file of walk(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8');
      expect(`${file}: ${text}`).not.toMatch(
        /data:\s*\.\.\.(?:dto|input|body|query)\b/,
      );
    }
  });

  it('API-04 user cannot pass Prisma where/orderBy/include', () => {
    for (const file of walk(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8');
      expect(`${file}: ${text}`).not.toMatch(
        /(?:where|orderBy|include):\s*(?:dto|body|query)\b/,
      );
    }
  });

  it('API-14 production sets trust proxy for the throttler IP', () => {
    expect(MAIN).toContain("app.set('trust proxy', 1)");
    expect(MAIN).toContain("NODE_ENV === 'production'");
  });

  it('API-20 enables shutdown hooks', () => {
    expect(MAIN).toContain('enableShutdownHooks');
  });

  it('API-11 listing loads share coverage in one query, not per child', () => {
    expect(LISTING).toContain('listTargetCoverage');
    expect(LISTING).not.toMatch(/for \(const file of input\.files\)/);
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
