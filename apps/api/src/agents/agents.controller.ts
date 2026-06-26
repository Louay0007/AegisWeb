import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, DomainErrorCode, Permission } from '@agentpass/domain';
import { RequirePermission } from '../authorization/authorization-metadata.js';
import { parsePageQuery, QueryRecord } from '../common/pagination.js';
import { CurrentOrganizationId } from '../request-context/current-organization-id.decorator.js';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { AgentActivityService } from './agent-activity.service.js';
import { AgentsService } from './agents.service.js';

const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  purpose: z.string().min(1).max(500),
  identifier: z.string().min(1).max(160).optional()
});

const updateAgentSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    purpose: z.string().min(1).max(500).optional()
  })
  .refine((value) => value.name !== undefined || value.purpose !== undefined, {
    message: 'At least one agent field is required.'
  });

@Controller('agents')
export class AgentsController {
  constructor(
    @Inject(AgentsService) private readonly agentsService: AgentsService,
    @Inject(AgentActivityService) private readonly activityService: AgentActivityService
  ) {}

  @RequirePermission(Permission.AgentRead)
  @Get()
  list(@CurrentOrganizationId() organizationId: string | undefined, @Query() query: QueryRecord) {
    return this.agentsService.list(organizationId, parsePageQuery(query));
  }

  @RequirePermission(Permission.AgentCreate)
  @Post()
  create(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = createAgentSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid agent create request.');
    }

    return this.agentsService.create(currentUser, parsed.data);
  }

  @RequirePermission(Permission.AgentRead)
  @Get(':id')
  get(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.agentsService.get(organizationId, id);
  }

  @RequirePermission(Permission.AgentUpdate)
  @Patch(':id')
  update(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateAgentSchema.safeParse(body);

    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid agent update request.');
    }

    return this.agentsService.update(currentUser, id, parsed.data);
  }

  @RequirePermission(Permission.AgentPause)
  @Post(':id/pause')
  pause(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.agentsService.pause(currentUser, id);
  }

  @RequirePermission(Permission.AgentPause)
  @Post(':id/resume')
  resume(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.agentsService.resume(currentUser, id);
  }

  @RequirePermission(Permission.AgentRevoke)
  @Post(':id/revoke')
  revoke(@CurrentUser() currentUser: ContextUser | undefined, @Param('id') id: string) {
    return this.agentsService.revoke(currentUser, id);
  }

  @RequirePermission(Permission.AgentRead)
  @Get(':id/activity')
  activity(@CurrentOrganizationId() organizationId: string | undefined, @Param('id') id: string) {
    return this.activityService.getActivity(organizationId, id);
  }
}
