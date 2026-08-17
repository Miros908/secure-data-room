import { ConflictException } from '@nestjs/common';
import { Prisma } from './generated/prisma/client';
import {
  isRetryableWriteConflict,
  isUniqueConflict,
  rethrowNameConflict,
} from './prisma-errors';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code,
    clientVersion: 'test',
  });
}

describe('rethrowNameConflict', () => {
  it('maps P2002 to name_taken', () => {
    expect(() => rethrowNameConflict(prismaError('P2002'))).toThrow(
      ConflictException,
    );
    try {
      rethrowNameConflict(prismaError('P2002'));
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        message: 'name_taken',
      });
    }
  });

  it('rethrows any other error', () => {
    const error = new Error('boom');
    expect(() => rethrowNameConflict(error)).toThrow(error);
    expect(() => rethrowNameConflict(prismaError('P2025'))).toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });
});

describe('isUniqueConflict', () => {
  it('is true only for P2002, including duck-typed errors', () => {
    expect(isUniqueConflict(prismaError('P2002'))).toBe(true);
    expect(isUniqueConflict({ code: 'P2002' })).toBe(true);
    expect(isUniqueConflict(prismaError('P2025'))).toBe(false);
    expect(isUniqueConflict(new Error('boom'))).toBe(false);
  });
});

describe('isRetryableWriteConflict', () => {
  it('retries unique, serialization and transaction timeouts', () => {
    expect(isRetryableWriteConflict(prismaError('P2002'))).toBe(true);
    expect(isRetryableWriteConflict(prismaError('P2034'))).toBe(true);
    expect(isRetryableWriteConflict(prismaError('P2028'))).toBe(true);
    expect(isRetryableWriteConflict(prismaError('P2025'))).toBe(false);
    expect(isRetryableWriteConflict(new Error('deadlock detected'))).toBe(true);
  });
});
