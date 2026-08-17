export const ACCESS_DURATION_PRESETS = [
  { id: 'hour', ms: 60 * 60 * 1000 },
  { id: 'day', ms: 24 * 60 * 60 * 1000 },
  { id: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'forever', ms: null },
] as const;

export type AccessDurationId = (typeof ACCESS_DURATION_PRESETS)[number]['id'];

export function expiresAtFromPreset(
  id: AccessDurationId,
  now = Date.now(),
): string | undefined {
  const preset = ACCESS_DURATION_PRESETS.find((item) => item.id === id);
  if (!preset || preset.ms === null) {
    return undefined;
  }

  return new Date(now + preset.ms).toISOString();
}
