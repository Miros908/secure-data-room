export function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function containsIlikePattern(query: string): string {
  return `%${escapeIlike(query)}%`;
}

export function prefixIlikePattern(value: string): string {
  return `${escapeIlike(value)}%`;
}
