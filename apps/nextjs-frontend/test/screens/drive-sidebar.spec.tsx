import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DriveSidebar } from '@/app/(pages)/drive/components/drive-sidebar';
import { renderWithProviders } from '../render';

const MY_ROOM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SHARED_ROOM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const rooms = {
  myRoom: {
    id: MY_ROOM_ID,
    name: 'Мой диск',
    role: 'owner' as const,
    accessExpiresAt: null,
    createdAt: '2026-08-16T12:00:00.000Z',
  },
  sharedRooms: [
    {
      id: SHARED_ROOM_ID,
      name: 'Acme',
      role: 'viewer' as const,
      accessExpiresAt: null,
      createdAt: '2026-08-16T12:00:00.000Z',
    },
  ],
};

const sidebarProps = {
  rooms,
  isLoading: false,
  myRoomId: MY_ROOM_ID,
  collapsed: false,
  mobileOpen: false,
  canCreate: true,
  onCloseMobile: vi.fn(),
  onCreateFolder: vi.fn(),
  onUpload: vi.fn(),
};

describe('DriveSidebar', () => {
  it('opens incoming shares as a menu item instead of listing them', () => {
    renderWithProviders(
      <DriveSidebar {...sidebarProps} activeRoomId={MY_ROOM_ID} view="folder" />,
    );

    expect(
      screen.getByRole('link', { name: 'Shared with me' }),
    ).toHaveAttribute('href', '/drive?view=incoming');
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Drive' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks incoming as current while browsing a shared room', () => {
    renderWithProviders(
      <DriveSidebar
        {...sidebarProps}
        activeRoomId={SHARED_ROOM_ID}
        view="folder"
      />,
    );

    expect(screen.getByRole('link', { name: 'Shared with me' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'My Drive' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
