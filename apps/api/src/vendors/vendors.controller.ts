import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission, VendorCategory, VENDOR_CATEGORIES, ConnectorType, CONNECTOR_TYPES } from '@agentpass/domain';
import { RequirePermission } from '../authorization/authorization-metadata.js';
import { parsePageQuery, QueryRecord } from '../common/pagination.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { VendorsService } from './vendors.service.js';

const categorySchema = z.custom<VendorCategory>(
  (value) => typeof value === 'string' && VENDOR_CATEGORIES.includes(value as VendorCategory)
);

const connectorTypeSchema = z.custom<ConnectorType>(
  (value) => typeof value === 'string' && CONNECTOR_TYPES.includes(value as ConnectorType)
);

const metadataSchema = z.record(z.unknown()).optional();

const createVendorSchema = z.object({
  name: z.string().min(1).max(160),
  website: z.string().url(),
  category: categorySchema,
  connectorType: connectorTypeSchema.optional(),
  renewalDate: z.string().date().optional(),
  monthlyCostCents: z.number().int().min(0).optional(),
  ownerUserId: z.string().uuid().optional(),
  metadataJson: metadataSchema
});

const updateVendorSchema = createVendorSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one vendor field is required.' });

@Controller('vendors')
export class VendorsController {
  constructor(@Inject(VendorsService) private readonly vendorsService: VendorsService) {}

  @RequirePermission(Permission.VendorRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.vendorsService.list(organizationId, parsePageQuery(query));
  }

  @RequirePermission(Permission.VendorCreate)
  @Post()
  create(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = createVendorSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid vendor create request.');
    }

    return this.vendorsService.create(currentUser, {
      ...parsed.data,
      metadataJson: parsed.data.metadataJson as Prisma.InputJsonObject | undefined
    });
  }

  @RequirePermission(Permission.VendorRead)
  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.vendorsService.get(organizationId, id);
  }

  @RequirePermission(Permission.VendorUpdate)
  @Patch(':id')
  update(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateVendorSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid vendor update request.');
    }

    return this.vendorsService.update(currentUser, id, {
      ...parsed.data,
      metadataJson: parsed.data.metadataJson as Prisma.InputJsonObject | undefined
    });
  }

  @RequirePermission(Permission.VendorUpdate)
  @Delete(':id')
  delete(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.vendorsService.delete(currentUser, id);
  }
}
