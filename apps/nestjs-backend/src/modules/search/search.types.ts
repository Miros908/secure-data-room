export type SearchHitRow = {
  id: string;
  name: string;
  kind: 'file' | 'folder';
  parent_id: string | null;
  created_at: Date;
  mime_type: string | null;
  size_bytes: bigint | number | null;
  version_count: number | bigint | null;
  folder_path: string | null;
};
