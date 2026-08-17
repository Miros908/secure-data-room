import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { DataRoomsController } from './data-rooms.controller';
import { DataRoomsRepository } from './data-rooms.repository';
import { CreateOwnedDataRoomService } from './services/create-owned-data-room.service';
import { GetDataRoomService } from './services/get-data-room.service';
import { GetMyDataRoomService } from './services/get-my-data-room.service';
import { ListDataRoomsService } from './services/list-data-rooms.service';

@Module({
  imports: [AccessModule],
  controllers: [DataRoomsController],
  providers: [
    DataRoomsRepository,
    CreateOwnedDataRoomService,
    GetMyDataRoomService,
    GetDataRoomService,
    ListDataRoomsService,
  ],
  exports: [CreateOwnedDataRoomService],
})
export class DataRoomsModule {}
