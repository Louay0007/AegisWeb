import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  DomainError,
  DomainErrorCode,
  Permission,
  WORKFLOW_STATUSES,
  WORKFLOW_TEMPLATES,
  WorkflowStatus,
  WorkflowTemplate
} from '@agentpass/domain';
import { RequirePermission } from '../authorization/authorization-metadata.js';
import { parsePageQuery, QueryRecord } from '../common/pagination.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { WorkflowTemplateService } from './workflow-template.service.js';
import { WorkflowsService } from './workflows.service.js';

const workflowTemplateSchema = z.custom<WorkflowTemplate>(
  (value) => typeof value === 'string' && WORKFLOW_TEMPLATES.includes(value as WorkflowTemplate)
);
const workflowStatusSchema = z.custom<WorkflowStatus>(
  (value) => typeof value === 'string' && WORKFLOW_STATUSES.includes(value as WorkflowStatus)
);

const configurationSchema = z.record(z.unknown()).default({});

const createWorkflowSchema = z.object({
  agentId: z.string().uuid(),
  vendorId: z.string().uuid(),
  name: z.string().min(1).max(160),
  template: workflowTemplateSchema,
  configurationJson: configurationSchema
});

const updateWorkflowSchema = createWorkflowSchema
  .extend({
    status: workflowStatusSchema.optional()
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one workflow field is required.' });

@Controller('workflows')
export class WorkflowsController {
  constructor(
    @Inject(WorkflowsService) private readonly workflowsService: WorkflowsService,
    @Inject(WorkflowTemplateService) private readonly templateService: WorkflowTemplateService
  ) {}

  @RequirePermission(Permission.WorkflowRead)
  @Get('templates')
  templates() {
    return this.templateService.list();
  }

  @RequirePermission(Permission.WorkflowRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.workflowsService.list(organizationId, parsePageQuery(query));
  }

  @RequirePermission(Permission.WorkflowCreate)
  @Post()
  create(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = createWorkflowSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid workflow create request.');
    }

    return this.workflowsService.create(currentUser, {
      ...parsed.data,
      configurationJson: parsed.data.configurationJson as Prisma.InputJsonObject
    });
  }

  @RequirePermission(Permission.WorkflowRead)
  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.workflowsService.get(organizationId, id);
  }

  @RequirePermission(Permission.WorkflowCreate)
  @Patch(':id')
  update(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateWorkflowSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid workflow update request.');
    }

    return this.workflowsService.update(currentUser, id, {
      ...parsed.data,
      configurationJson: parsed.data.configurationJson as Prisma.InputJsonObject | undefined
    });
  }

  @RequirePermission(Permission.WorkflowRun)
  @Post(':id/runs')
  startRun(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.workflowsService.startRun(currentUser, id);
  }
}
