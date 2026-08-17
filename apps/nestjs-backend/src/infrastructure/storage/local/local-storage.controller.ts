import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Public } from '../../../modules/auth/decorators/public.decorator';
import { contentDispositionHeader } from '../content-disposition';
import type { StorageConfig } from '../storage.config';
import { StorageNotFoundError } from '../storage.errors';
import type { StorageService } from '../storage.service';
import { STORAGE_CONFIG, STORAGE_SERVICE } from '../storage.tokens';
import {
  verifyLocalDownloadUrl,
  type LocalDownloadClaims,
} from './local-download-url';

@Controller('storage')
export class LocalStorageController {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject(STORAGE_CONFIG) private readonly config: StorageConfig,
  ) {}

  @Public()
  @Get('objects')
  async download(
    @Query() query: Record<string, unknown>,
  ): Promise<StreamableFile> {
    if (this.config.driver !== 'local') {
      throw new NotFoundException('not_found');
    }

    let claims: LocalDownloadClaims;
    try {
      claims = verifyLocalDownloadUrl(
        this.config.local.signingSecret,
        toSearchParams(query),
      );
    } catch {
      throw new ForbiddenException('forbidden');
    }

    try {
      const object = await this.storage.get(claims.key);
      return new StreamableFile(object.body, {
        type: claims.contentType || object.contentType,
        length: object.contentLength,
        disposition: contentDispositionHeader(
          claims.disposition,
          claims.filename,
        ),
      });
    } catch (error) {
      if (error instanceof StorageNotFoundError) {
        throw new NotFoundException('not_found');
      }
      throw error;
    }
  }
}

function toSearchParams(query: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  return params;
}
