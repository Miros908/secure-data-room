import { contentDispositionHeader } from './content-disposition';

describe('contentDispositionHeader', () => {
  it('UP-39 does not allow CR/LF in the header', () => {
    const header = contentDispositionHeader(
      'inline',
      'report\r\nContent-Type: text/html.pdf',
    );
    expect(header).not.toMatch(/\r|\n/);
  });

  it('encodes unicode in filename*', () => {
    const header = contentDispositionHeader('inline', 'Договор.pdf');
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain(encodeURIComponent('Договор.pdf'));
  });
});
