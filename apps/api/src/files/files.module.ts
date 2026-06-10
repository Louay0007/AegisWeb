import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { FilesController } from './files.controller.js';
import { FileStorageService } from './file-storage.service.js';
import { FilesService } from './files.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [FilesController],
  providers: [FilesService, FileStorageService],
  exports: [FilesService, FileStorageService]
})
export class FilesModule {}
