import type { Readable } from 'node:stream';

export const DEFAULT_DOWNLOAD_TTL_SECONDS = 15 * 60;

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type DownloadUrlInput = {
  filename?: string;
  contentType?: string;
  expiresInSeconds?: number;
  disposition?: 'inline' | 'attachment';
};

export type DownloadUrl = {
  url: string;
  expiresAt: Date;
};

export type StoredObject = {
  body: Readable;
  contentType: string;
  contentLength: number;
};

export interface StorageService {
  put(input: PutObjectInput): Promise<void>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  getDownloadUrl(key: string, input?: DownloadUrlInput): Promise<DownloadUrl>;
}
