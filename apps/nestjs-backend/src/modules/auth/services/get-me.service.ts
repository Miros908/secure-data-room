import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@sdr/shared/auth';
import type { SessionUser } from '../decorators/current-user.decorator';

@Injectable()
export class GetMeService {
  execute(user: SessionUser): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
