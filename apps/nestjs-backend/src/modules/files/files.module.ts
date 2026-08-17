import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ActivityCoreModule } from '../activity/activity-core.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { FilesController } from './files.controller';
import { FilesRepository } from './files.repository';
import { DeleteFileService } from './services/delete-file.service';
import { GetFileService } from './services/get-file.service';
import { GetFileVersionService } from './services/get-file-version.service';
import { ListFileVersionsService } from './services/list-file-versions.service';
import { MoveFileService } from './services/move-file.service';
import { RenameFileService } from './services/rename-file.service';
import { UploadFileService } from './services/upload-file.service';

@Module({
  imports: [AccessModule, AuthModule, EventsModule, ActivityCoreModule],
  controllers: [FilesController],
  providers: [
    FilesRepository,
    UploadFileService,
    GetFileService,
    ListFileVersionsService,
    GetFileVersionService,
    RenameFileService,
    MoveFileService,
    DeleteFileService,
  ],
})
export class FilesModule {}
