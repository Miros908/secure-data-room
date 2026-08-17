import type { Prisma } from './generated/prisma/client';
import type { PrismaService } from './prisma.service';

export const PRISMA_INTERACTIVE_TRANSACTION = {
  maxWait: 2_000,
  timeout: 5_000,
} as const;

export type PrismaTx = Prisma.TransactionClient;
export type PrismaDb = PrismaService | PrismaTx;
