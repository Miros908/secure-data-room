import { normalizeNodeName } from './normalize-node-name';

describe('normalizeNodeName', () => {
  it('trims ASCII padding', () => {
    expect(normalizeNodeName('  Reports  ')).toBe('Reports');
  });

  it('stores NFD as NFC so unique indexes collide', () => {
    const nfc = 'cafe\u00e9';
    const nfd = 'cafe\u0065\u0301';
    expect(normalizeNodeName(nfd)).toBe(nfc);
    expect(normalizeNodeName(nfc)).toBe(nfc);
  });
});
