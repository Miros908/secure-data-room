import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'src');
const NEXT_CONFIG = readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8');
const QUERY_PROVIDER = readFileSync(
  path.join(SRC, 'providers/query-provider.tsx'),
  'utf8',
);
const LOGOUT = readFileSync(
  path.join(SRC, 'app/hooks/mutations/use-logout.ts'),
  'utf8',
);
const UPLOAD = readFileSync(
  path.join(SRC, 'app/hooks/mutations/use-upload-files.ts'),
  'utf8',
);
const LAYOUT = readFileSync(path.join(SRC, 'app/layout.tsx'), 'utf8');
const SHARE_PAGE = readFileSync(
  path.join(SRC, 'app/(pages)/share/page.tsx'),
  'utf8',
);
const DRIVE_PAGE = readFileSync(
  path.join(SRC, 'app/(pages)/drive/page.tsx'),
  'utf8',
);
const DRIVE_HREF = readFileSync(
  path.join(SRC, 'app/(pages)/drive/components/drive-location.ts'),
  'utf8',
);
const BROWSER = readFileSync(
  path.join(SRC, 'app/(pages)/drive/components/drive-browser.tsx'),
  'utf8',
);
const SHARE_VIEWER = readFileSync(
  path.join(SRC, 'app/(pages)/share/components/share-file-viewer.tsx'),
  'utf8',
);
const DRIVE_VIEWER = readFileSync(
  path.join(SRC, 'app/(pages)/drive/components/drive-file-viewer.tsx'),
  'utf8',
);
const PDF_FRAME = readFileSync(
  path.join(SRC, 'app/components/pdf-frame.tsx'),
  'utf8',
);
const BREADCRUMBS = readFileSync(
  path.join(SRC, 'app/(pages)/drive/components/drive-breadcrumbs.tsx'),
  'utf8',
);
const DRIVE_UI_STORE = readFileSync(
  path.join(SRC, 'store/drive-ui.store.ts'),
  'utf8',
);
const THEME_STORE = readFileSync(path.join(SRC, 'store/theme.store.ts'), 'utf8');
const LOCALE_STORE = readFileSync(path.join(SRC, 'store/locale.store.ts'), 'utf8');

describe('FE source invariants', () => {
  it('FE-01 / FE-07 / FE-08 private and share pages are not public-cached', () => {
    expect(DRIVE_PAGE).toContain("dynamic = 'force-dynamic'");
    expect(SHARE_PAGE).toContain("dynamic = 'force-dynamic'");
    expect(SHARE_PAGE).toContain('index: false');
    expect(SHARE_PAGE).not.toContain('generateMetadata');
    expect(NEXT_CONFIG).toContain('private, no-store');
    expect(NEXT_CONFIG).toContain('no-referrer');
    expect(NEXT_CONFIG).toContain('noindex, nofollow');
    expect(PDF_FRAME).toContain('referrerPolicy="no-referrer"');
    expect(PDF_FRAME).toContain('location.replace');
  });

  it('FE-02 QueryClient is created per provider instance, not as a module singleton', () => {
    expect(QUERY_PROVIDER).toContain('useState(createQueryClient)');
    expect(QUERY_PROVIDER).not.toMatch(
      /export const queryClient = new QueryClient/,
    );
  });

  it('proxies API JSON through /backend so the session cookie is first-party', () => {
    expect(NEXT_CONFIG).toContain("source: '/backend/:path*'");
    expect(NEXT_CONFIG).toContain('API_PROXY_ORIGIN');
  });

  it('FE-03 logout clears the React Query cache', () => {
    expect(LOGOUT).toContain('queryClient.clear()');
  });

  it('FE-04 persisted stores are theme, locale, and drive UI only; no token localStorage', () => {
    expect(THEME_STORE).toContain("name: 'sdr-theme'");
    expect(LOCALE_STORE).toContain("name: 'sdr-locale'");
    expect(DRIVE_UI_STORE).toContain("name: 'sdr-drive-ui'");
    expect(DRIVE_UI_STORE).not.toMatch(/token|downloadUrl|signed/);

    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      expect(`${file}: ${text}`).not.toMatch(/dangerouslySetInnerHTML/);
      if (
        file.endsWith('theme.store.ts') ||
        file.endsWith('locale.store.ts')
      ) {
        continue;
      }
      expect(`${file}: ${text}`).not.toMatch(/localStorage\.(setItem|getItem)/);
    }
  });

  it('FE-09 / FE-11 / FE-12 upload queue is per-file with concurrency 3', () => {
    expect(UPLOAD).toContain('UPLOAD_CONCURRENCY = 3');
    expect(UPLOAD).toContain("status: 'error'");
    expect(UPLOAD).toContain('progress');
  });

  it('FE-20 breadcrumbs come from API contents, not a client tree', () => {
    expect(BREADCRUMBS).toContain('contents.breadcrumbs');
  });

  it('FE-21 drive URLs use folderId/fileId, not names', () => {
    expect(DRIVE_HREF).toContain("params.set('folderId', input.folderId)");
    expect(DRIVE_HREF).toContain("params.set('fileId', input.fileId)");
    expect(DRIVE_HREF).not.toMatch(/params\.set\('name'/);
  });

  it('OBS-12 viewers record a view once and download via POST, not the iframe URL', () => {
    expect(DRIVE_VIEWER).toContain('useRecordFileView(file?.id)');
    expect(SHARE_VIEWER).toContain('useRecordFileView(file?.id, token)');
    expect(DRIVE_VIEWER).toContain('<FileDownloadButton');
    expect(SHARE_VIEWER).toContain('<FileDownloadButton');
    expect(DRIVE_VIEWER).not.toMatch(/href=\{preview\.downloadUrl\}/);
    expect(SHARE_VIEWER).not.toMatch(/href=\{preview\.downloadUrl\}/);
  });

  it('FE-17 deleted folder offers a safe return to /drive', () => {
    expect(BROWSER).toContain("router.replace('/drive')");
    expect(BROWSER).toContain('folderNotFound');
  });

  it('FE-22 does not create object URLs', () => {
    expect(existsSync(SRC)).toBe(true);
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      expect(`${file}: ${text}`).not.toMatch(/createObjectURL|revokeObjectURL/);
    }
  });

  it('public pages ship Open Graph tags and a PNG preview image', () => {
    expect(LAYOUT).toContain('metadataBase');
    expect(LAYOUT).toContain('openGraph');
    expect(LAYOUT).toContain('summary_large_image');
    expect(existsSync(path.join(SRC, 'app/opengraph-image.png'))).toBe(true);
    expect(existsSync(path.join(SRC, 'app/robots.ts'))).toBe(true);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}
