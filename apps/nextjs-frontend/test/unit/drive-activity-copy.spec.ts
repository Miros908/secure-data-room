import { describe, expect, it } from 'vitest';
import { activityEventLabel } from '@/app/(pages)/drive/components/drive-activity-copy';

const EVENT_TYPES = [
  'file_viewed',
  'file_downloaded',
  'link_opened',
  'access_granted',
  'access_revoked',
  'file_deleted',
  'folder_deleted',
] as const;

describe('drive-activity-copy', () => {
  it('labels every event type in English', () => {
    expect(activityEventLabel('file_viewed')).toBe('View');
    expect(activityEventLabel('file_downloaded')).toBe('Download');
    expect(activityEventLabel('link_opened')).toBe('Opened link');
    expect(activityEventLabel('access_granted')).toBe('Access given');
    expect(activityEventLabel('access_revoked')).toBe('Access removed');
    expect(activityEventLabel('file_deleted')).toBe('File deleted');
    expect(activityEventLabel('folder_deleted')).toBe('Folder deleted');
    expect(EVENT_TYPES.map(activityEventLabel)).toHaveLength(7);
  });
});
