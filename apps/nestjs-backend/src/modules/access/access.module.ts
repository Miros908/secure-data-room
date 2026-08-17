import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventsModule } from '../events/events.module';
import { ActivityCoreModule } from '../activity/activity-core.module';
import { AccessController } from './access.controller';
import { AccessRepository } from './access.repository';
import { PublicAbuseGuard } from './guards/public-abuse.guard';
import { AcceptInviteService } from './services/accept-invite.service';
import { CreatePublicLinkService } from './services/create-public-link.service';
import { GrantService } from './services/grant.service';
import { InviteService } from './services/invite.service';
import { ListIncomingSharesService } from './services/list-incoming-shares.service';
import { ListOutgoingSharesService } from './services/list-outgoing-shares.service';
import { ListSharesService } from './services/list-shares.service';
import { ResolvePublicLinkService } from './services/resolve-public-link.service';
import { ResolveService } from './services/resolve.service';
import { RevokeService } from './services/revoke.service';
import { ShareByEmailService } from './services/share-by-email.service';

@Module({
  imports: [EventsModule, ActivityCoreModule],
  controllers: [AccessController],
  providers: [
    AccessRepository,
    ResolveService,
    GrantService,
    InviteService,
    AcceptInviteService,
    CreatePublicLinkService,
    RevokeService,
    ListSharesService,
    ListIncomingSharesService,
    ListOutgoingSharesService,
    ResolvePublicLinkService,
    ShareByEmailService,
    {
      provide: APP_GUARD,
      useClass: PublicAbuseGuard,
    },
  ],
  exports: [ResolveService, AcceptInviteService, AccessRepository],
})
export class AccessModule {}
