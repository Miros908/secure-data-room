import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BACKEND_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(BACKEND_ROOT, '../..');
const GITIGNORE = readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
const ENV_EXAMPLE = readFileSync(
  path.join(BACKEND_ROOT, '.env.example'),
  'utf8',
);
const PACKAGE_JSON = readFileSync(
  path.join(BACKEND_ROOT, 'package.json'),
  'utf8',
);

describe('OPS repo and start invariants', () => {
  it('OPS-01 gitignores env files; example has no live secrets', () => {
    expect(GITIGNORE).toMatch(/^\.env$/m);
    expect(GITIGNORE).toContain('.env.*');
    expect(ENV_EXAMPLE).toMatch(/^R2_SECRET_ACCESS_KEY=$/m);
    expect(ENV_EXAMPLE).not.toMatch(/AKIA[0-9A-Z]{16}/);
  });

  it('OPS-09 production start runs migrate deploy', () => {
    expect(PACKAGE_JSON).toContain('prisma migrate deploy && node dist/main');
  });

  it('OPS-16 lockfile is committed', () => {
    expect(existsSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'))).toBe(true);
  });
});
