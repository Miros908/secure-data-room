import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { SearchController } from './search.controller';
import { SearchRepository } from './search.repository';
import { SearchDriveService } from './services/search-drive.service';

@Module({
  imports: [AccessModule],
  controllers: [SearchController],
  providers: [SearchRepository, SearchDriveService],
})
export class SearchModule {}
