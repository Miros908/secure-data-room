import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from '../access/access.module';
import { AuthController } from './auth.controller';
import { AUTH_ABUSE_LIMIT, AUTH_ABUSE_WINDOW_MS } from './auth.constants';
import { AuthRepository } from './auth.repository';
import { CsrfOriginGuard } from './guards/csrf-origin.guard';
import { SessionGuard } from './guards/session.guard';
import { UploadAuthGuard } from './guards/upload-auth.guard';
import { CreateUploadTicketService } from './services/create-upload-ticket.service';
import { GetMeService } from './services/get-me.service';
import { LoginService } from './services/login.service';
import { LogoutService } from './services/logout.service';
import { RegisterService } from './services/register.service';

@Module({
  imports: [
    AccessModule,
    ThrottlerModule.forRoot({
      skipIf: () =>
        process.env.NODE_ENV === 'test' && process.env.E2E_THROTTLE !== '1',
      throttlers: [{ ttl: AUTH_ABUSE_WINDOW_MS, limit: AUTH_ABUSE_LIMIT }],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    GetMeService,
    LoginService,
    LogoutService,
    RegisterService,
    CreateUploadTicketService,
    SessionGuard,
    CsrfOriginGuard,
    UploadAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: CsrfOriginGuard,
    },
  ],
  exports: [AuthRepository, CreateUploadTicketService, UploadAuthGuard],
})
export class AuthModule {}
