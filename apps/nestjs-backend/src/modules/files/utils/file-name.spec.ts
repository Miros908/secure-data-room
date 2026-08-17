import { decodeMultipartFileName, sanitizeFileName } from './file-name';

describe('decodeMultipartFileName', () => {
  it('restores a UTF-8 name that multer read as latin1', () => {
    const mojibake = Buffer.from('Договор.pdf', 'utf8').toString('latin1');
    expect(decodeMultipartFileName(mojibake)).toBe('Договор.pdf');
  });

  it('keeps an already-decoded unicode name', () => {
    expect(decodeMultipartFileName('Договор.pdf')).toBe('Договор.pdf');
  });

  it('keeps ascii names', () => {
    expect(decodeMultipartFileName('report.pdf')).toBe('report.pdf');
  });
});

describe('sanitizeFileName', () => {
  it('keeps a simple pdf name', () => {
    expect(sanitizeFileName('report.pdf')).toBe('report.pdf');
  });

  it('strips a path and adds a pdf extension', () => {
    expect(sanitizeFileName('C:\\\\tmp\\\\notes')).toBe('notes.pdf');
  });

  it('falls back when the name is empty', () => {
    expect(sanitizeFileName('')).toBe('document.pdf');
  });

  it('strips CR LF so Content-Disposition cannot be injected', () => {
    expect(sanitizeFileName('evil\r\n.pdf')).toBe('evil.pdf');
    expect(sanitizeFileName('a\r\nContent-Type: text/html.pdf')).toBe(
      'html.pdf',
    );
  });

  it('normalizes NFD to NFC', () => {
    expect(sanitizeFileName('cafe\u0065\u0301.pdf')).toBe('cafe\u00e9.pdf');
  });

  it('strips NUL and other C0 controls', () => {
    expect(sanitizeFileName('evil\u0000name.pdf')).toBe('evilname.pdf');
  });

  it('truncates to 255 characters', () => {
    const name = `${'a'.repeat(300)}.pdf`;
    expect(sanitizeFileName(name).length).toBe(255);
  });
});
