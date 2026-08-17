import type { AccessSubjectType } from '@sdr/shared/access';

export const accessQueryKeys = {
  all: ['access'] as const,
  shares: (input: { type: AccessSubjectType; id: string }) =>
    [...accessQueryKeys.all, 'shares', input] as const,
  incoming: () => [...accessQueryKeys.all, 'incoming'] as const,
  outgoing: () => [...accessQueryKeys.all, 'outgoing'] as const,
  publicLink: (token: string) =>
    [...accessQueryKeys.all, 'public-link', token] as const,
};
