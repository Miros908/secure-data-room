import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveAccessPanel } from '@/app/(pages)/drive/components/drive-access-panel';
import { apiError } from '../api-error';
import { renderWithProviders } from '../render';

const listShares = vi.hoisted(() => vi.fn());
const createPublicLink = vi.hoisted(() => vi.fn());
const shareByEmail = vi.hoisted(() => vi.fn());
const revokeAccess = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/list-shares.fetcher', () => ({ listShares }));
vi.mock('@/app/api/create-public-link.poster', () => ({ createPublicLink }));
vi.mock('@/app/api/share-by-email.poster', () => ({ shareByEmail }));
vi.mock('@/app/api/revoke-access.poster', () => ({ revokeAccess }));

const SUBJECT_ID = '22222222-2222-4222-8222-222222222222';

describe('DriveAccessPanel duration presets', () => {
  beforeEach(() => {
    listShares.mockReset();
    createPublicLink.mockReset();
    shareByEmail.mockReset();
    revokeAccess.mockReset();
    listShares.mockResolvedValue({
      grants: [],
      invitations: [],
      publicLink: null,
      inherited: [],
    });
    createPublicLink.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      type: 'file',
      subjectId: SUBJECT_ID,
      expiresAt: '2026-08-16T13:00:00.000Z',
      token: 'ab'.repeat(32),
    });
  });

  it('sends the selected public-link duration as expiresAt', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(
      Date.parse('2026-08-16T12:00:00.000Z'),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DriveAccessPanel
        type="file"
        id={SUBJECT_ID}
        name="term-sheet.pdf"
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Link expiration'), 'hour');
    await user.click(screen.getByRole('button', { name: 'Create link' }));

    await waitFor(() => {
      expect(createPublicLink).toHaveBeenCalledWith(
        {
          type: 'file',
          id: SUBJECT_ID,
          expiresAt: '2026-08-16T13:00:00.000Z',
        },
        expect.anything(),
      );
    });
  });

  it('omits expiresAt for a forever people grant', async () => {
    shareByEmail.mockResolvedValue({
      kind: 'invite',
      id: '66666666-6666-4666-8666-666666666666',
      email: 'colleague@company.com',
      role: 'viewer',
      type: 'file',
      subjectId: SUBJECT_ID,
      expiresAt: '2026-08-23T12:00:00.000Z',
      accessExpiresAt: null,
      token: 'cd'.repeat(32),
    });
    const user = userEvent.setup();
    renderWithProviders(
      <DriveAccessPanel
        type="file"
        id={SUBJECT_ID}
        name="term-sheet.pdf"
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Email'), 'colleague@company.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(shareByEmail).toHaveBeenCalledWith(
        {
          email: 'colleague@company.com',
          type: 'file',
          id: SUBJECT_ID,
          role: 'viewer',
          expiresAt: undefined,
        },
        expect.anything(),
      );
    });
  });

  it('explains that access is already covered by a parent folder', async () => {
    const folderId = '55555555-5555-4555-8555-555555555555';
    const roomId = '33333333-3333-4333-8333-333333333333';
    listShares.mockResolvedValue({
      grants: [],
      invitations: [],
      publicLink: null,
      inherited: [
        {
          source: {
            type: 'folder',
            id: folderId,
            name: 'Договоры',
            dataRoomId: roomId,
          },
          grants: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              userId: '77777777-7777-4777-8777-777777777777',
              email: 'colleague@company.com',
              name: 'Colleague',
              role: 'viewer',
              expiresAt: null,
            },
          ],
          invitations: [],
          publicLink: null,
        },
      ],
    });
    shareByEmail.mockRejectedValue(
      apiError({ code: 'already_covered', statusCode: 409 }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <DriveAccessPanel
        type="file"
        id={SUBJECT_ID}
        name="term-sheet.pdf"
        onClose={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    await screen.findByText('Colleague · colleague@company.com');
    await user.type(screen.getByLabelText('Email'), 'colleague@company.com');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(
      'This person already has access from “Договоры”',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
