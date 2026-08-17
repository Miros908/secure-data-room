import {
  fileSchema,
  uploadTicketResponseSchema,
  type FileDto,
} from '@sdr/shared/files';
import { apiClient, uploadApiClient } from '@/infrastructure/http/api-client';
import { usesCrossOriginUpload } from '@/infrastructure/http/api-base-url';

export type UploadFileInput = {
  file: File;
  dataRoomId: string;
  folderId?: string;
};

export async function uploadFile(
  input: UploadFileInput,
  onProgress?: (percent: number) => void,
): Promise<FileDto> {
  const body = new FormData();
  body.append('file', input.file);
  body.append('name', input.file.name);
  body.append('dataRoomId', input.dataRoomId);
  if (input.folderId) {
    body.append('folderId', input.folderId);
  }

  const headers: Record<string, string | boolean> = {
    'Content-Type': false,
  };
  const client = usesCrossOriginUpload() ? uploadApiClient : apiClient;

  if (usesCrossOriginUpload()) {
    const ticket = await createUploadTicket();
    headers['X-Upload-Ticket'] = ticket;
  }

  const response = await client.post('/files', body, {
    headers,
    withCredentials: !usesCrossOriginUpload(),
    transformRequest: [
      (data, requestHeaders) => {
        requestHeaders.delete('Content-Type');
        return data;
      },
    ],
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) {
        return;
      }

      onProgress(Math.min(95, Math.round((event.loaded / event.total) * 100)));
    },
  });

  return fileSchema.parse(response.data);
}

async function createUploadTicket(): Promise<string> {
  const response = await apiClient.post('/files/upload-ticket');
  return uploadTicketResponseSchema.parse(response.data).ticket;
}
