import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { ActivityCoreModule } from '../activity/activity-core.module';
import { EventsModule } from '../events/events.module';
import { FoldersController } from './folders.controller';
import { FoldersRepository } from './folders.repository';
import { CreateFolderService } from './services/create-folder.service';
import { DeleteFolderService } from './services/delete-folder.service';
import { ListFolderContentsService } from './services/list-folder-contents.service';
import { RenameFolderService } from './services/rename-folder.service';

@Module({
  imports: [AccessModule, EventsModule, ActivityCoreModule],
  controllers: [FoldersController],
  providers: [
    FoldersRepository,
    CreateFolderService,
    ListFolderContentsService,
    RenameFolderService,
    DeleteFolderService,
  ],
})
export class FoldersModule {}
