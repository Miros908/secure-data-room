import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  getFileQuerySchema,
  moveFileSchema,
  renameFileSchema,
  uploadFileFieldsSchema,
  type GetFileQuery,
  type MoveFileDto,
  type RenameFileDto,
  type UploadFileFieldsDto,
} from '@sdr/shared/files';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../zod-validation.pipe';
import {
  CurrentUser,
  OptionalUser,
  type SessionUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UploadAuthGuard } from '../auth/guards/upload-auth.guard';
import { CreateUploadTicketService } from '../auth/services/create-upload-ticket.service';
import { MAX_FILE_BYTES } from './files.constants';
import { DeleteFileService } from './services/delete-file.service';
import { GetFileService } from './services/get-file.service';
import { GetFileVersionService } from './services/get-file-version.service';
import { ListFileVersionsService } from './services/list-file-versions.service';
import { MoveFileService } from './services/move-file.service';
import { RenameFileService } from './services/rename-file.service';
import { UploadFileService } from './services/upload-file.service';

@Controller('files')
export class FilesController {
  constructor(
    private readonly uploadFileService: UploadFileService,
    private readonly getFileService: GetFileService,
    private readonly listFileVersionsService: ListFileVersionsService,
    private readonly getFileVersionService: GetFileVersionService,
    private readonly renameFileService: RenameFileService,
    private readonly moveFileService: MoveFileService,
    private readonly deleteFileService: DeleteFileService,
    private readonly createUploadTicketService: CreateUploadTicketService,
  ) {}

  @Post('upload-ticket')
  createUploadTicket(@CurrentUser() user: SessionUser) {
    return this.createUploadTicketService.execute(user);
  }

  @Public()
  @UseGuards(UploadAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_BYTES },
      defParamCharset: 'utf8',
    }),
  )
  async upload(
    @CurrentUser() user: SessionUser,
    @UploadedFile()
    file:
      { originalname: string; mimetype: string; buffer: Buffer } | undefined,
    @Body(new ZodValidationPipe(uploadFileFieldsSchema))
    dto: UploadFileFieldsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('file_required');
    }

    const uploaded = await this.uploadFileService.execute({
      ...dto,
      userId: user.id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      body: file.buffer,
    });
    res.status(uploaded.isNewVersion ? 200 : 201);
    return uploaded;
  }

  @Public()
  @Get(':id/versions/:versionId')
  getVersion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(getFileQuerySchema)) query: GetFileQuery,
  ) {
    return this.getFileVersionService.execute({
      id,
      versionId,
      userId: user?.id ?? null,
      token: query.token,
    });
  }

  @Public()
  @Get(':id/versions')
  listVersions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(getFileQuerySchema)) query: GetFileQuery,
  ) {
    return this.listFileVersionsService.execute({
      id,
      userId: user?.id ?? null,
      token: query.token,
    });
  }

  @Public()
  @Get(':id')
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OptionalUser() user: SessionUser | null,
    @Query(new ZodValidationPipe(getFileQuerySchema)) query: GetFileQuery,
  ) {
    return this.getFileService.execute({
      id,
      userId: user?.id ?? null,
      token: query.token,
    });
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(renameFileSchema)) dto: RenameFileDto,
  ) {
    return this.renameFileService.execute({ ...dto, id, userId: user.id });
  }

  @Post(':id/move')
  move(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(moveFileSchema)) dto: MoveFileDto,
  ) {
    return this.moveFileService.execute({ ...dto, id, userId: user.id });
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.deleteFileService.execute({ id, userId: user.id });
  }
}
