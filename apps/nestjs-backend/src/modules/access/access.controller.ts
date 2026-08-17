import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  acceptInviteSchema,
  createPublicLinkSchema,
  grantAccessSchema,
  inviteAccessSchema,
  listSharesSchema,
  resolvePublicLinkSchema,
  revokeAccessSchema,
  shareByEmailSchema,
  type AcceptInviteDto,
  type CreatePublicLinkDto,
  type GrantAccessDto,
  type InviteAccessDto,
  type ListSharesDto,
  type ResolvePublicLinkDto,
  type RevokeAccessDto,
  type ShareByEmailDto,
} from '@sdr/shared/access';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import {
  CurrentUser,
  OptionalUser,
  type SessionUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AcceptInviteService } from './services/accept-invite.service';
import { CreatePublicLinkService } from './services/create-public-link.service';
import { GrantService } from './services/grant.service';
import { InviteService } from './services/invite.service';
import { ListIncomingSharesService } from './services/list-incoming-shares.service';
import { ListOutgoingSharesService } from './services/list-outgoing-shares.service';
import { ListSharesService } from './services/list-shares.service';
import { ResolvePublicLinkService } from './services/resolve-public-link.service';
import { RevokeService } from './services/revoke.service';
import { ShareByEmailService } from './services/share-by-email.service';

@Controller('access')
export class AccessController {
  constructor(
    private readonly grantService: GrantService,
    private readonly inviteService: InviteService,
    private readonly acceptInviteService: AcceptInviteService,
    private readonly createPublicLinkService: CreatePublicLinkService,
    private readonly revokeService: RevokeService,
    private readonly listSharesService: ListSharesService,
    private readonly listIncomingSharesService: ListIncomingSharesService,
    private readonly listOutgoingSharesService: ListOutgoingSharesService,
    private readonly resolvePublicLinkService: ResolvePublicLinkService,
    private readonly shareByEmailService: ShareByEmailService,
  ) {}

  @Post('grants')
  grant(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(grantAccessSchema)) dto: GrantAccessDto,
  ) {
    return this.grantService.execute({ ...dto, grantedById: user.id });
  }

  @Post('people')
  shareByEmail(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(shareByEmailSchema)) dto: ShareByEmailDto,
  ) {
    return this.shareByEmailService.execute({
      ...dto,
      grantedById: user.id,
    });
  }

  @Post('invitations')
  invite(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(inviteAccessSchema)) dto: InviteAccessDto,
  ) {
    return this.inviteService.execute({ ...dto, grantedById: user.id });
  }

  @Post('invitations/accept')
  @HttpCode(200)
  acceptInvite(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(acceptInviteSchema)) dto: AcceptInviteDto,
  ) {
    return this.acceptInviteService.execute({
      userId: user.id,
      email: user.email,
      token: dto.token,
    });
  }

  @Post('public-links')
  createPublicLink(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createPublicLinkSchema))
    dto: CreatePublicLinkDto,
  ) {
    return this.createPublicLinkService.execute({
      ...dto,
      createdById: user.id,
    });
  }

  @Post('revoke')
  @HttpCode(200)
  revoke(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(revokeAccessSchema)) dto: RevokeAccessDto,
  ) {
    return this.revokeService.execute({ ...dto, actorId: user.id });
  }

  @Get('shares')
  listShares(
    @CurrentUser() user: SessionUser,
    @Query(new ZodValidationPipe(listSharesSchema)) query: ListSharesDto,
  ) {
    return this.listSharesService.execute({ ...query, actorId: user.id });
  }

  @Get('incoming')
  listIncoming(@CurrentUser() user: SessionUser) {
    return this.listIncomingSharesService.execute({ userId: user.id });
  }

  @Get('outgoing')
  listOutgoing(@CurrentUser() user: SessionUser) {
    return this.listOutgoingSharesService.execute({ ownerId: user.id });
  }

  @Public()
  @Get('public-links/resolve')
  resolvePublicLink(
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(resolvePublicLinkSchema))
    query: ResolvePublicLinkDto,
  ) {
    return this.resolvePublicLinkService.execute({
      ...query,
      userId: user?.id ?? null,
    });
  }
}
