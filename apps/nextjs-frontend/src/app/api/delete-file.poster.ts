import { z } from 'zod';
import { apiClient } from '@/infrastructure/http/api-client';

const deleteFileResponseSchema = z.object({
  ok: z.literal(true),
});

export type DeleteFileResponse = z.infer<typeof deleteFileResponseSchema>;

export async function deleteFile(id: string): Promise<DeleteFileResponse> {
  const response = await apiClient.delete(`/files/${id}`);
  return deleteFileResponseSchema.parse(response.data);
}
