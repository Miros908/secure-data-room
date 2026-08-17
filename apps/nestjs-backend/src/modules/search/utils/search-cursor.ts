import { z } from 'zod';

const searchCursorSchema = z.object({
  name: z.string(),
  kind: z.enum(['file', 'folder']),
  id: z.uuid(),
});

export type SearchCursor = z.infer<typeof searchCursorSchema>;

export function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeSearchCursor(cursor: string): SearchCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    const result = searchCursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
