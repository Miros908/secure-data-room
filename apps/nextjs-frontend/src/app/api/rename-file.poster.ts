import { fileSchema, type FileDto, type RenameFileDto } from '@sdr/shared/files';
import { apiClient } from '@/infrastructure/http/api-client';

export async function renameFile(
  id: string,
  dto: RenameFileDto,
): Promise<FileDto> {
  const response = await apiClient.patch(`/files/${id}`, dto);
  return fileSchema.parse(response.data);
}
