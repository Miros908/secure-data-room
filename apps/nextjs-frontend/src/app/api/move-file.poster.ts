import { fileSchema, type FileDto, type MoveFileDto } from '@sdr/shared/files';
import { apiClient } from '@/infrastructure/http/api-client';

export async function moveFile(id: string, dto: MoveFileDto): Promise<FileDto> {
  const response = await apiClient.post(`/files/${id}/move`, dto);
  return fileSchema.parse(response.data);
}
