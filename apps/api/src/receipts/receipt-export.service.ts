import { Injectable } from '@nestjs/common';
import { ReceiptDetailDto } from './receipts.types.js';

export type ReceiptExport = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

@Injectable()
export class ReceiptExportService {
  exportJson(receipt: ReceiptDetailDto): ReceiptExport {
    return {
      filename: `receipt-${receipt.id}.json`,
      mimeType: 'application/json; charset=utf-8',
      bytes: Buffer.from(JSON.stringify({ data: receipt }, null, 2), 'utf8')
    };
  }
}
