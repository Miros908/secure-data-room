import { Injectable } from '@nestjs/common';
import type { ShareByEmailDto, ShareByEmailResponse } from '@sdr/shared/access';
import { InviteService } from './invite.service';

export type ShareByEmailInput = ShareByEmailDto & {
  grantedById: string;
};

@Injectable()
export class ShareByEmailService {
  constructor(private readonly inviteService: InviteService) {}

  async execute(input: ShareByEmailInput): Promise<ShareByEmailResponse> {
    const invite = await this.inviteService.execute(input);

    return {
      kind: 'invite',
      ...invite,
    };
  }
}
