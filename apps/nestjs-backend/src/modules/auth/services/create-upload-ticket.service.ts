import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { UploadTicketResponse } from '@sdr/shared/files';
import { AuthRepository } from '../auth.repository';
import type { SessionUser } from '../decorators/current-user.decorator';
import { createUploadTicket } from '../utils/upload-ticket';

@Injectable()
export class CreateUploadTicketService {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(user: SessionUser): Promise<UploadTicketResponse> {
    const session = await this.authRepository.findActiveById(user.sessionId);
    if (!session) {
      throw new UnauthorizedException('unauthorized');
    }

    const issued = createUploadTicket(session.id, session.tokenHash);
    return {
      ticket: issued.ticket,
      expiresAt: issued.expiresAt.toISOString(),
    };
  }
}
