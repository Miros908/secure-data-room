import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser, LoginDto } from '@sdr/shared/auth';
import { compare } from 'bcryptjs';
import { AcceptInviteService } from '../../access/services/accept-invite.service';
import { AuthRepository } from '../auth.repository';
import { generateSessionToken, hashSessionToken } from '../utils/session-token';
import { SESSION_TTL_MS } from '../auth.constants';

export type LoginResult = {
  user: AuthUser;
  rawToken: string;
  expiresAt: Date;
};

@Injectable()
export class LoginService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly acceptInviteService: AcceptInviteService,
  ) {}

  async execute(input: LoginDto): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.authRepository.findByEmail(email);

    if (!user?.passwordHash) {
      throw new UnauthorizedException('unauthorized');
    }

    const passwordMatches = await compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('unauthorized');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('forbidden');
    }

    const rawToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.authRepository.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(rawToken),
      expiresAt,
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
