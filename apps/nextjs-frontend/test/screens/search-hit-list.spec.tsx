import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchHitList } from '@/app/components/search-hit-list';
import { renderWithProviders } from '../render';

const FOLDER = {
  kind: 'folder' as const,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Legal',
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  breadcrumbs: [],
};

const FILE = {
  kind: 'file' as const,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Term Sheet.pdf',
  parentId: FOLDER.id,
  createdAt: '2026-01-02T00:00:00.000Z',
  breadcrumbs: [{ id: FOLDER.id, name: 'Legal' }],
  mimeType: 'application/pdf',
  sizeBytes: 1200,
  versionCount: 1,
};

describe('SearchHitList', () => {
  it('renders file location and links', () => {
    renderWithProviders(
      <SearchHitList
        items={[FOLDER, FILE]}
        folderHref={() => '/drive?folderId=folder'}
        fileHref={() => '/drive?fileId=file'}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/drive?folderId=folder');
    expect(links[1]).toHaveAttribute('href', '/drive?fileId=file');
    expect(screen.getByText('Term Sheet.pdf')).toBeInTheDocument();
  });

  it('shows load more', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    renderWithProviders(
      <SearchHitList
        items={[FILE]}
        folderHref={() => '/drive'}
        fileHref={() => '/drive'}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Load more|Ещё|Ще/ }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
