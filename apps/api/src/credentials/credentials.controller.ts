import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  CREDENTIAL_TYPES,
  CredentialType,
  DomainError,
  DomainErrorCode,
  Permission
} from '@agentpass/domain';
import { InternalRoute, RequirePermission } from '../authorization/authorization-metadata.js';
import { InternalWorkerGuard } from '../authorization/internal-worker.guard.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { CredentialsService } from './credentials.service.js';

const credentialTypeSchema = z.custom<CredentialType>(
  (value) => typeof value === 'string' && CREDENTIAL_TYPES.includes(value as CredentialType)
);
const secretSchema = z.record(z.unknown()).refine((value) => Object.keys(value).length > 0, {
  message: 'Secret payload cannot be empty.'
});

const createCredentialSchema = z.object({
  vendorId: z.string().uuid(),
  label: z.string().min(1).max(160),
  credentialType: credentialTypeSchema,
  secretJson: secretSchema
});

const updateCredentialSchema = z
  .object({
    vendorId: z.string().uuid().optional(),
    label: z.string().min(1).max(160).optional(),
    credentialType: credentialTypeSchema.optional(),
    secretJson: secretSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one credential field is required.' });

const grantSchema = z.object({
  agentId: z.string().uuid(),
  scope: z.string().min(1).max(80).default('login')
});

const decryptForRunSchema = z.object({
  workflowRunId: z.string().uuid()
});

@Controller('credentials')
export class CredentialsController {
  constructor(@Inject(CredentialsService) private readonly credentialsService: CredentialsService) {}

  @RequirePermission(Permission.CredentialRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined) {
    return this.credentialsService.list(organizationId);
  }

  @RequirePermission(Permission.CredentialCreate)
  @Post()
  create(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = createCredentialSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid credential create request.');
    }

    return this.credentialsService.create(currentUser, parsed.data);
  }

  @RequirePermission(Permission.CredentialRead)
  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.credentialsService.get(organizationId, id);
  }

  @RequirePermission(Permission.CredentialCreate)
  @Patch(':id')
  update(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateCredentialSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid credential update request.');
    }

    return this.credentialsService.update(currentUser, id, parsed.data);
  }

  @RequirePermission(Permission.CredentialGrant)
  @Post(':id/grants')
  grant(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid credential grant request.');
    }

    return this.credentialsService.grant(currentUser, id, parsed.data);
  }

  @RequirePermission(Permission.CredentialRevoke)
  @Delete(':id/grants/:grantId')
  revokeGrant(
    @CurrentUser() currentUser: ContextUser | undefined,
    @Param('id') id: string,
    @Param('grantId') grantId: string
  ) {
    return this.credentialsService.revokeGrant(currentUser, id, grantId);
  }

  @RequirePermission(Permission.CredentialRevoke)
  @Post(':id/revoke')
  revoke(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.credentialsService.revoke(currentUser, id);
  }
}

@Controller('internal/vault/credentials')
export class InternalCredentialsController {
  constructor(@Inject(CredentialsService) private readonly credentialsService: CredentialsService) {}

  @InternalRoute()
  @UseGuards(InternalWorkerGuard)
  @Post(':id/decrypt-for-run')
  decryptForRun(@Param('id') id: string, @Body() body: unknown) {
    const parsed = decryptForRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid credential decrypt request.');
    }

    return this.credentialsService.decryptForRun(id, parsed.data);
  }
}
