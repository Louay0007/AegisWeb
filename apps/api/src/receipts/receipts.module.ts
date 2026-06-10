import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ReceiptExportService } from './receipt-export.service.js';
import { ReceiptRedactionService } from './receipt-redaction.service.js';
import { ReceiptSummaryBuilder } from './receipt-summary.builder.js';
import { ReceiptTimelineBuilder } from './receipt-timeline.builder.js';
import { ReceiptsController } from './receipts.controller.js';
import { ReceiptsService } from './receipts.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    ReceiptTimelineBuilder,
    ReceiptSummaryBuilder,
    ReceiptExportService,
    ReceiptRedactionService
  ],
  exports: [ReceiptsService]
})
export class ReceiptsModule {}
