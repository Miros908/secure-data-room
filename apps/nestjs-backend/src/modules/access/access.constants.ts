export const ROLE_RANK = {
  none: 0,
  viewer: 1,
  editor: 2,
  owner: 3,
} as const;

export type EffectiveRole = keyof typeof ROLE_RANK;
export type GrantRole = Extract<EffectiveRole, 'viewer' | 'editor'>;

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ACCESS_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const MIN_SIGNED_URL_TTL_SECONDS = 30;
