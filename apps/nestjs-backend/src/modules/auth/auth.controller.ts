import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  loginSchema,
  registerSchema,
  type LoginDto,
  type RegisterDto,
} from '@sdr/shared/auth';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import {
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from './auth.constants';
import {
  CurrentUser,
  type SessionUser,
} from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { GetMeService } from './services/get-me.service';
import { LoginService } from './services/login.service';
import { LogoutService } from './services/logout.service';
import { RegisterService } from './services/register.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginService: LoginService,
    private readonly logoutService: LogoutService,
    private readonly registerService: RegisterService,
    private readonly getMeService: GetMeService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: SessionUser) {
    return this.getMeService.execute(user);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.registerService.execute(dto);
    if (result.rawToken) {
      res.append('Set-Cookie', serializeSessionCookie(result.rawToken));
    }
    return result.user;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.loginService.execute(dto);
    res.append('Set-Cookie', serializeSessionCookie(result.rawToken));
    return result.user;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.logoutService.execute(user.sessionId);
    res.append('Set-Cookie', serializeClearedSessionCookie());
    return { ok: true };
  }
}
