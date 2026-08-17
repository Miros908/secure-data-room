import { Injectable } from '@nestjs/common';
import { PRISMA_INTERACTIVE_TRANSACTION } from '../../database/prisma-transaction';
import { PrismaService } from '../../database/prisma.service';

export type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
};

export type SessionRecord = {
  id: string;
  user: {
    id: string;
    email: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED';
  };
};

export type SessionRecordWithTokenHash = SessionRecord & {
  tokenHash: string;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password_hash: true,
        status: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.password_hash,
      status: user.status,
    };
  }

  async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<SessionRecord | null> {
    const session = await this.prisma.auth_sessions.findFirst({
      where: {
        refresh_token_hash: tokenHash,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        status: session.user.status,
      },
    };
  }

  async findActiveById(
    sessionId: string,
  ): Promise<SessionRecordWithTokenHash | null> {
    const session = await this.prisma.auth_sessions.findFirst({
      where: {
        id: sessionId,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      select: {
        id: true,
        refresh_token_hash: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      tokenHash: session.refresh_token_hash,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        status: session.user.status,
      },
    };
  }

  async createRegisteredAccount(params: {
    email: string;
    name: string;
    passwordHash: string;
    sessionTokenHash: string;
    sessionExpiresAt: Date;
    dataRoomName: string;
  }): Promise<{ id: string; email: string; name: string }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          email: params.email,
          name: params.name,
          password_hash: params.passwordHash,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      await tx.auth_sessions.create({
        data: {
          user_id: user.id,
          refresh_token_hash: params.sessionTokenHash,
          expires_at: params.sessionExpiresAt,
        },
      });

      await tx.data_rooms.create({
        data: {
          owner_id: user.id,
          name: params.dataRoomName,
        },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    }, PRISMA_INTERACTIVE_TRANSACTION);
  }

  async createSession(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const session = await this.prisma.auth_sessions.create({
      data: {
        user_id: params.userId,
        refresh_token_hash: params.tokenHash,
        expires_at: params.expiresAt,
      },
      select: { id: true },
    });

    return { id: session.id };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.auth_sessions.updateMany({
      where: { id: sessionId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}
