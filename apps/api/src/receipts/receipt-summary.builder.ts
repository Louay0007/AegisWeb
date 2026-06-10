import { Injectable } from '@nestjs/common';
export type ReceiptSummaryInput = {
  storedSummary: string;
  run: {
    status: string;
    errorMessage: string | null;
    resultSummary: string | null;
  };
};

@Injectable()
export class ReceiptSummaryBuilder {
  build(input: ReceiptSummaryInput): string {
    if (input.run.status === 'FAILED' && input.run.errorMessage) {
      return `${input.storedSummary} Error: ${input.run.errorMessage}`;
    }

    if (input.run.resultSummary && !input.storedSummary.includes(input.run.resultSummary)) {
      return `${input.storedSummary} ${input.run.resultSummary}`;
    }

    return input.storedSummary;
  }
}
