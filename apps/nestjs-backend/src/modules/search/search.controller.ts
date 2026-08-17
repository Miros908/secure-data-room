import { Controller, Get, Query } from '@nestjs/common';
import {
  searchDriveQuerySchema,
  type SearchDriveQuery,
} from '@sdr/shared/search';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import {
  OptionalUser,
  type SessionUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SearchDriveService } from './services/search-drive.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchDriveService: SearchDriveService) {}

  @Public()
  @Get()
  search(
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(searchDriveQuerySchema))
    query: SearchDriveQuery,
  ) {
    return this.searchDriveService.execute({
      ...query,
      userId: user?.id ?? null,
    });
  }
}
