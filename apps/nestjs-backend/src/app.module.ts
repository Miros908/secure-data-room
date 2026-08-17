import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppExceptionFilter } from './app-exception.filter';
import { PrismaModule } from './database/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { DataRoomsModule } from './modules/data-rooms/data-rooms.module';
import { EventsModule } from './modules/events/events.module';
import { FilesModule } from './modules/files/files.module';
import { FoldersModule } from './modules/folders/folders.module';
import { SearchModule } from './modules/search/search.module';
import { ActivityModule } from './modules/activity/activity.module';
import { NoStoreCacheInterceptor } from './no-store-cache.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    EventsModule,
    ActivityModule,
    AccessModule,
    DataRoomsModule,
    FoldersModule,
    FilesModule,
    SearchModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: NoStoreCacheInterceptor,
    },
  ],
})
export class AppModule {}
