import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../auth.repository';

@Injectable()
export class LogoutService {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(sessionId: string): Promise<void> {
    await this.authRepository.revokeSession(sessionId);
  }
}
