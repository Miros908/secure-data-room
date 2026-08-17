import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const FRONTEND_ROOT = path.resolve(__dirname, '../../../nextjs-frontend');
const SECRET_HINT =
  /R2_SECRET|R2_ACCESS_KEY|AWS_SECRET|AWS_ACCESS_KEY|NEXT_PUBLIC_R2|NEXT_PUBLIC_AWS/i;

/**
 * Чек-лист §4 UP-02
 * R2 credentials не должны попасть во frontend bundle / NEXT_PUBLIC_*.
 */
describe('UP-02 R2 credentials are not in the frontend', () => {
  it('frontend source and env example do not embed R2/AWS keys', () => {
    const files = [
      path.join(FRONTEND_ROOT, '.env.example'),
      ...walk(path.join(FRONTEND_ROOT, 'src')),
    ];

    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(`${file}: ${text}`).not.toMatch(SECRET_HINT);
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js')
      ? [full]
      : [];
  });
}
