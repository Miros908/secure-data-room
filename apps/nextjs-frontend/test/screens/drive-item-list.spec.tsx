import type { FolderContents } from '@sdr/shared/folders';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DriveItemList } from '@/app/(pages)/drive/components/drive-item-list';
import { FILE_DETAIL, USER } from '../api-error';
import { routerPush } from '../navigation';
import { renderWithProviders } from '../render';

const FOLDER_ID = '55555555-5555-4555-8555-555555555555';

const contents: FolderContents = {
  folder: null,
  dataRoomId: FILE_DETAIL.dataRoomId,
  role: 'owner',
  accessExpiresAt: null,
  breadcrumbs: [],
  folders: [
    {
      id: FOLDER_ID,
      name: 'Legal',
      createdAt: FILE_DETAIL.createdAt,
      sharing: {
        peopleCount: 1,
        pendingCount: 0,
        hasPublicLink: false,
        inheritedFrom: null,
      },
    },
  ],
  files: [
    {
      id: FILE_DETAIL.id,
      name: FILE_DETAIL.name,
      createdAt: FILE_DETAIL.createdAt,
      sizeBytes: FILE_DETAIL.sizeBytes,
      mimeType: FILE_DETAIL.mimeType,
      versionCount: FILE_DETAIL.versionCount,
      sharing: {
        peopleCount: 0,
        pendingCount: 0,
        hasPublicLink: true,
        inheritedFrom: null,
      },
    },
  ],
};

function listProps() {
  return {
    contents,
    myRoomId: USER.id,
    viewMode: 'grid' as const,
    sortKey: 'name' as const,
    sortDir: 'asc' as const,
    selectedKeys: new Set<string>(),
    focusedKey: null,
    canWrite: true,
    canShare: true,
    onToggleSelect: vi.fn(),
    onFocusKey: vi.fn(),
    onOpenFile: vi.fn(),
    onShareFolder: vi.fn(),
    onShareFile: vi.fn(),
    onSort: vi.fn(),
    contextMenu: null,
    onContextMenu: vi.fn(),
  };
}

describe('DriveItemList grid cards', () => {
  it('does not nest sharing controls inside the open button or folder link', () => {
    const { container } = renderWithProviders(<DriveItemList {...listProps()} />);

    expect(container.querySelector('button button')).toBeNull();
    expect(container.querySelector('a button')).toBeNull();
    expect(container.querySelector('button a')).toBeNull();
  });

  it('opens sharing from the status control without opening the file', async () => {
    const user = userEvent.setup();
    const props = listProps();
    renderWithProviders(<DriveItemList {...props} />);

    await user.click(screen.getByTitle('link'));
    expect(props.onShareFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: FILE_DETAIL.id }),
    );
    expect(props.onOpenFile).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();

    expect(screen.getByRole('link', { name: FILE_DETAIL.name })).toHaveAttribute(
      'href',
      expect.stringContaining(`fileId=${FILE_DETAIL.id}`),
    );
  });

  it('hides rename, move and delete when the user can only view', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DriveItemList
        {...listProps()}
        canWrite={false}
        canShare={false}
        onRenameFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onMoveFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onDeleteFolder={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File actions' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Rename' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Move' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Delete' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
  });

  it('shows rename when the user can write', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DriveItemList
        {...listProps()}
        onRenameFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onMoveFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onDeleteFolder={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File actions' }));
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
  });

  it('lets the owner drag a file onto a folder card', () => {
    const onDropFileToFolder = vi.fn();
    renderWithProviders(
      <DriveItemList {...listProps()} onDropFileToFolder={onDropFileToFolder} />,
    );

    const fileCard = screen.getByRole('link', { name: FILE_DETAIL.name })
      .parentElement;
    expect(fileCard).toHaveAttribute('draggable', 'true');

    const dataTransfer = {
      setData: vi.fn(),
      getData: (type: string) =>
        type === 'application/x-sdr-file' ? FILE_DETAIL.id : '',
      types: ['application/x-sdr-file'],
      effectAllowed: 'all',
      dropEffect: 'none',
    };

    fireEvent.dragStart(fileCard!, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-sdr-file',
      FILE_DETAIL.id,
    );

    fireEvent.drop(screen.getByRole('link', { name: /Legal/ }), {
      dataTransfer,
    });
    expect(onDropFileToFolder).toHaveBeenCalledWith(FILE_DETAIL.id, FOLDER_ID);
  });

  it('does not let a viewer drag files', () => {
    renderWithProviders(
      <DriveItemList
        {...listProps()}
        canWrite={false}
        canShare={false}
      />,
    );

    expect(
      screen.getByRole('link', { name: FILE_DETAIL.name }).parentElement,
    ).not.toHaveAttribute('draggable', 'true');
  });
});

describe('DriveItemList list rows', () => {
  it('hides rename, move and delete when the user can only view', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DriveItemList
        {...listProps()}
        viewMode="list"
        canWrite={false}
        canShare={false}
        onRenameFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onMoveFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onDeleteFolder={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'File actions' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Rename' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Move' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Delete' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Folder actions' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Rename' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Delete' }),
    ).not.toBeInTheDocument();
  });

  it('opens a file when the owner clicks the row', async () => {
    const user = userEvent.setup();
    const props = listProps();
    renderWithProviders(<DriveItemList {...props} viewMode="list" />);

    await user.click(screen.getByText('1.0 KB'));
    expect(props.onToggleSelect).not.toHaveBeenCalled();
    expect(props.onOpenFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: FILE_DETAIL.id }),
    );
  });

  it('selects a file when the owner clicks the checkbox', async () => {
    const user = userEvent.setup();
    const props = listProps();
    renderWithProviders(<DriveItemList {...props} viewMode="list" />);

    await user.click(
      screen.getByRole('checkbox', { name: `Select ${FILE_DETAIL.name}` }),
    );
    expect(props.onToggleSelect).toHaveBeenCalledWith(
      `file:${FILE_DETAIL.id}`,
      expect.objectContaining({ shift: false }),
    );
    expect(props.onOpenFile).not.toHaveBeenCalled();
  });

  it('opens a shared file on row click instead of selecting it', async () => {
    const user = userEvent.setup();
    const props = {
      ...listProps(),
      viewMode: 'list' as const,
      canWrite: false,
      canShare: false,
    };
    renderWithProviders(<DriveItemList {...props} />);

    await user.click(screen.getByText('1.0 KB'));
    expect(props.onToggleSelect).not.toHaveBeenCalled();
    expect(props.onOpenFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: FILE_DETAIL.id }),
    );
  });
});
