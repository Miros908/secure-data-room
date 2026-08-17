import { buildFileStorageKey } from './storage-key';

describe('buildFileStorageKey', () => {
  it('uses prefix, room id, file id and version id only', () => {
    expect(
      buildFileStorageKey(
        'test',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
      ),
    ).toBe(
      'test/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333',
    );
  });

  it('does not put the original filename into the key', () => {
    const key = buildFileStorageKey('prod', 'room-id', 'file-id', 'version-id');
    expect(key).not.toContain('.pdf');
    expect(key).not.toContain('report');
  });
});
