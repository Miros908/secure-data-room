import { Injectable } from '@nestjs/common';
import type { AuthUser, RegisterDto } from '@sdr/shared/auth';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { AcceptInviteService } from '../../access/services/accept-invite.service';
import { DEFAULT_DATA_ROOM_NAME } from '../../data-rooms/data-rooms.constants';
import { SESSION_TTL_MS } from '../auth.constants';
import { AuthRepository } from '../auth.repository';
import { generateSessionToken, hashSessionToken } from '../utils/session-token';

const PASSWORD_SALT_ROUNDS = 10;

export type RegisterResult = {
  user: AuthUser;
  rawToken: string | null;
  expiresAt: Date | null;
};

@Injectable()
export class RegisterService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly acceptInviteService: AcceptInviteService,
  ) {}

  async execute(input: RegisterDto): Promise<RegisterResult> {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    const existing = await this.authRepository.findByEmail(email);
    const passwordHash = await hash(input.password, PASSWORD_SALT_ROUNDS);

    if (existing) {
      return {
        user: {
          id: randomUUID(),
          email,
          name,
        },
        rawToken: null,
        expiresAt: null,
      };
    }

    const rawToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const user = await this.authRepository.createRegisteredAccount({
      email,
      name,
      passwordHash,
      sessionTokenHash: hashSessionToken(rawToken),
      sessionExpiresAt: expiresAt,
      dataRoomName: DEFAULT_DATA_ROOM_NAME,
    });

    await this.acceptInviteService.execute({
      userId: user.id,
      email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      rawToken,
      expiresAt,
    };
  }
}
