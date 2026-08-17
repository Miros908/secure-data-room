import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  createFolderSchema,
  getFolderQuerySchema,
  listRootFolderQuerySchema,
  renameFolderSchema,
  type CreateFolderDto,
  type GetFolderQuery,
  type ListRootFolderQuery,
  type RenameFolderDto,
} from '@sdr/shared/folders';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import {
  CurrentUser,
  OptionalUser,
  type SessionUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateFolderService } from './services/create-folder.service';
import { DeleteFolderService } from './services/delete-folder.service';
import { ListFolderContentsService } from './services/list-folder-contents.service';
import { RenameFolderService } from './services/rename-folder.service';

@Controller('folders')
export class FoldersController {
  constructor(
    private readonly createFolderService: CreateFolderService,
    private readonly listFolderContentsService: ListFolderContentsService,
    private readonly renameFolderService: RenameFolderService,
    private readonly deleteFolderService: DeleteFolderService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createFolderSchema)) dto: CreateFolderDto,
  ) {
    return this.createFolderService.execute({ ...dto, userId: user.id });
  }

  @Public()
  @Get()
  listRoot(
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(listRootFolderQuerySchema))
    query: ListRootFolderQuery,
  ) {
    return this.listFolderContentsService.execute({
      dataRoomId: query.dataRoomId,
      userId: user?.id ?? null,
      token: query.token,
    });
  }

  @Public()
  @Get(':id')
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(getFolderQuerySchema)) query: GetFolderQuery,
  ) {
    return this.listFolderContentsService.execute({
      folderId: id,
      userId: user?.id ?? null,
      token: query.token,
    });
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(renameFolderSchema)) dto: RenameFolderDto,
  ) {
    return this.renameFolderService.execute({
      ...dto,
      id,
      userId: user.id,
    });
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.deleteFolderService.execute({ id, userId: user.id });
  }
}
