import { Global, Module } from '@nestjs/common';
import { LocalStorageController } from './local/local-storage.controller';
import { loadStorageConfig } from './storage.config';
import { createStorageAdapter } from './storage.factory';
import { STORAGE_CONFIG, STORAGE_SERVICE } from './storage.tokens';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    {
      provide: STORAGE_CONFIG,
      useFactory: loadStorageConfig,
    },
    {
      provide: STORAGE_SERVICE,
      useFactory: createStorageAdapter,
      inject: [STORAGE_CONFIG],
    },
  ],
  exports: [STORAGE_SERVICE, STORAGE_CONFIG],
})
export class StorageModule {}
