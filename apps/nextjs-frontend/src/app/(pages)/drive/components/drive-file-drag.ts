export const FILE_DRAG_MIME = 'application/x-sdr-file';

export function setFileDragData(dataTransfer: DataTransfer, fileId: string) {
  dataTransfer.setData(FILE_DRAG_MIME, fileId);
  dataTransfer.effectAllowed = 'move';
}

export function hasFileDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(FILE_DRAG_MIME);
}

export function readFileDragId(dataTransfer: DataTransfer): string | null {
  const fileId = dataTransfer.getData(FILE_DRAG_MIME);
  return fileId.length > 0 ? fileId : null;
}
