import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  getDataRoomQuerySchema,
  type GetDataRoomQuery,
} from '@sdr/shared/data-rooms';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import {
  CurrentUser,
  OptionalUser,
  type SessionUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { GetDataRoomService } from './services/get-data-room.service';
import { GetMyDataRoomService } from './services/get-my-data-room.service';
import { ListDataRoomsService } from './services/list-data-rooms.service';

@Controller('data-rooms')
export class DataRoomsController {
  constructor(
    private readonly getMyDataRoomService: GetMyDataRoomService,
    private readonly listDataRoomsService: ListDataRoomsService,
    private readonly getDataRoomService: GetDataRoomService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: SessionUser) {
    return this.getMyDataRoomService.execute({ userId: user.id });
  }

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.listDataRoomsService.execute({ userId: user.id });
  }

  @Public()
  @Get(':id')
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(getDataRoomQuerySchema))
    query: GetDataRoomQuery,
  ) {
    return this.getDataRoomService.execute({
      id,
      userId: user?.id ?? null,
      token: query.token,
    });
  }
}
