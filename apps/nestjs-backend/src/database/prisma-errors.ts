import { ConflictException } from '@nestjs/common';

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}

export function isUniqueConflict(error: unknown): boolean {
  return prismaCode(error) === 'P2002';
}

export function isRetryableWriteConflict(error: unknown): boolean {
  const code = prismaCode(error);
  if (code === 'P2002' || code === 'P2034' || code === 'P2028') {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes('40P01') || message.includes('deadlock detected');
}

export function rethrowNameConflict(error: unknown): never {
  if (isUniqueConflict(error)) {
    throw new ConflictException('name_taken');
  }

  throw error;
}
