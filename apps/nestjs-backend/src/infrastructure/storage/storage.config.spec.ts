import { readFileSync } from 'node:fs';
import path from 'node:path';

const configSource = readFileSync(
  path.join(__dirname, 'storage.config.ts'),
  'utf8',
);

describe('storage config', () => {
  it('UP-04 reads R2 bucket and keys from env, not literals', () => {
    expect(configSource).toContain("required('R2_BUCKET')");
    expect(configSource).toContain("required('R2_ACCESS_KEY_ID')");
    expect(configSource).toContain("required('R2_SECRET_ACCESS_KEY')");
    expect(configSource).toContain("required('R2_ENDPOINT')");
    expect(configSource).not.toMatch(/bucket:\s*['"`][a-z0-9-]+['"`]/i);
  });
});
