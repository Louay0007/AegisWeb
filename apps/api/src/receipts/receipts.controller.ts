import { Controller, Get, Header, Inject, Param, Query, Res } from '@nestjs/common';
import { ReceiptStatus } from '@prisma/client';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission } from '@agentpass/domain';
import { RequirePermission } from '../authorization/authorization-metadata.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { ReceiptExportService } from './receipt-export.service.js';
import { ReceiptsService } from './receipts.service.js';
import { ReceiptListQuery } from './receipts.types.js';

type QueryValue = string | string[] | undefined;
type QueryRecord = Record<string, QueryValue>;

type ExportResponse = {
  setHeader(name: string, value: string | number): void;
  send(body: Buffer): void;
};

const querySchema = z.object({
  workflowRunId: z.string().uuid().optional(),
  finalStatus: z.nativeEnum(ReceiptStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

@RequirePermission(Permission.ReceiptRead)
@Controller('receipts')
export class ReceiptsController {
  constructor(
    @Inject(ReceiptsService) private readonly receipts: ReceiptsService,
    @Inject(ReceiptExportService) private readonly exports: ReceiptExportService
  ) {}

  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.receipts.list(organizationId, parseQuery(query));
  }

  @Get(':id/export')
  @Header('cache-control', 'no-store')
  async export(
    @CurrentOrganizationId() organizationId: string | undefined,
    @Param('id') id: string,
    @Res() response: ExportResponse
  ) {
    const receipt = await this.receipts.getDetail(organizationId, id);
    const exported = this.exports.exportJson(receipt);

    response.setHeader('content-type', exported.mimeType);
    response.setHeader('content-length', exported.bytes.length);
    response.setHeader('content-disposition', `attachment; filename="${exported.filename}"`);
    response.send(exported.bytes);
  }

  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.receipts.get(organizationId, id);
  }
}

function parseQuery(query: QueryRecord): ReceiptListQuery {
  const parsed = querySchema.safeParse({
    workflowRunId: first(query.workflowRunId),
    finalStatus: normalizeStatus(first(query.finalStatus)),
    limit: first(query.limit),
    offset: first(query.offset)
  });

  if (!parsed.success) {
    throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid receipt query.');
  }

  return parsed.data;
}

function normalizeStatus(value: string | undefined): ReceiptStatus | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(ReceiptStatus).find((status) => status === value.toUpperCase());
}

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
