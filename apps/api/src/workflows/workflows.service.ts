import { Inject, Injectable } from '@nestjs/common';
import {
  AgentStatus,
  AuditActorType,
  AuditEventType,
  CredentialStatus,
  PolicyStatus,
  PolicyType,
  Prisma,
  WorkflowRunStatus,
  WorkflowStatus as PrismaWorkflowStatus,
  Workflow
} from '@prisma/client';
import { DomainError, DomainErrorCode, WorkflowStatus, WorkflowTemplate } from '@agentpass/domain';
import { AuditService } from '../audit/audit.service.js';
import { PageQuery, pageToSkip, paginationMeta } from '../common/pagination.js';
import { DatabaseService } from '../database/database.service.js';
import { WorkflowQueueService } from '../queue/workflow-queue.service.js';
import { ContextUser } from '../request-context/types.js';
import { fromPrismaWorkflowTemplate, toPrismaWorkflowStatus, toPrismaWorkflowTemplate } from './workflow-type-mapping.js';
import { WorkflowValidationService } from './workflow-validation.service.js';
import { toWorkflowDto, toWorkflowRunDto } from './workflows.types.js';

export type CreateWorkflowInput = {
  agentId: string;
  vendorId: string;
  name: string;
  template: WorkflowTemplate;
  configurationJson: Prisma.InputJsonObject;
};

export type UpdateWorkflowInput = Partial<CreateWorkflowInput> & {
  status?: WorkflowStatus;
};

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkflowValidationService) private readonly validation: WorkflowValidationService,
    @Inject(WorkflowQueueService) private readonly queue: WorkflowQueueService
  ) {}

  async list(organizationId: string | undefined, page: PageQuery) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const where = { organizationId };
    const [workflows, total] = await Promise.all([
      this.database.client.workflow.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
        skip: pageToSkip(page),
        take: page.limit
      }),
      this.database.client.workflow.count({ where })
    ]);

    return { data: workflows.map(toWorkflowDto), meta: paginationMeta(total, page) };
  }

  async get(organizationId: string | undefined, id: string) {
    const workflow = await this.findWorkflowInOrganization(organizationId, id);
    return { data: toWorkflowDto(workflow) };
  }

  async create(currentUser: ContextUser | undefined, input: CreateWorkflowInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    await this.assertActiveAgent(currentUser.organizationId, input.agentId);
    await this.assertActiveVendor(currentUser.organizationId, input.vendorId);
    this.validation.validateConfiguration(input.template, input.configurationJson, input.vendorId);
    await this.assertCredentialGrantForConfig(currentUser.organizationId, input.agentId, input.vendorId, input.configurationJson);

    const workflow = await this.database.client.workflow.create({
      data: {
        organizationId: currentUser.organizationId,
        agentId: input.agentId,
        vendorId: input.vendorId,
        name: input.name,
        template: toPrismaWorkflowTemplate(input.template),
        status: PrismaWorkflowStatus.ACTIVE,
        configurationJson: input.configurationJson,
        createdByUserId: currentUser.id
      }
    });

    await this.recordWorkflowAudit(currentUser, workflow, AuditEventType.WORKFLOW_CREATED, {
      workflowId: workflow.id,
      agentId: workflow.agentId,
      vendorId: workflow.vendorId,
      template: input.template,
      name: workflow.name
    });

    return { data: toWorkflowDto(workflow) };
  }

  async update(currentUser: ContextUser | undefined, id: string, input: UpdateWorkflowInput) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const existing = await this.findWorkflowInOrganization(currentUser.organizationId, id);
    const agentId = input.agentId ?? existing.agentId;
    const vendorId = input.vendorId ?? existing.vendorId;
    const template = input.template ?? fromPrismaWorkflowTemplate(existing.template);
    const configurationJson = input.configurationJson ?? existing.configurationJson;

    await this.assertActiveAgent(currentUser.organizationId, agentId);
    await this.assertActiveVendor(currentUser.organizationId, vendorId);
    this.validation.validateConfiguration(template, configurationJson as Record<string, unknown>, vendorId);
    await this.assertCredentialGrantForConfig(currentUser.organizationId, agentId, vendorId, configurationJson);

    const workflow = await this.database.client.workflow.update({
      where: { id: existing.id },
      data: {
        agentId: input.agentId,
        vendorId: input.vendorId,
        name: input.name,
        template: input.template ? toPrismaWorkflowTemplate(input.template) : undefined,
        status: input.status ? toPrismaWorkflowStatus(input.status) : undefined,
        configurationJson: input.configurationJson
      }
    });

    await this.recordWorkflowAudit(currentUser, workflow, AuditEventType.WORKFLOW_UPDATED, {
      workflowId: workflow.id,
      agentId: workflow.agentId,
      vendorId: workflow.vendorId,
      template: workflow.template,
      name: workflow.name
    });

    return { data: toWorkflowDto(workflow) };
  }

  async startRun(currentUser: ContextUser | undefined, id: string) {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }

    const workflow = await this.findWorkflowInOrganization(currentUser.organizationId, id);
    if (workflow.status !== PrismaWorkflowStatus.ACTIVE) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Only active workflows can be run.');
    }

    await this.assertActiveAgent(currentUser.organizationId, workflow.agentId);
    await this.assertActiveVendor(currentUser.organizationId, workflow.vendorId);
    await this.assertActivePolicy(currentUser.organizationId, workflow.agentId);
    this.validation.validateConfiguration(
      fromPrismaWorkflowTemplate(workflow.template),
      workflow.configurationJson as Record<string, unknown>,
      workflow.vendorId
    );
    await this.assertCredentialGrantForConfig(
      currentUser.organizationId,
      workflow.agentId,
      workflow.vendorId,
      workflow.configurationJson
    );

    const run = await this.database.client.workflowRun.create({
      data: {
        organizationId: currentUser.organizationId,
        workflowId: workflow.id,
        agentId: workflow.agentId,
        vendorId: workflow.vendorId,
        status: WorkflowRunStatus.QUEUED,
        stateJson: {
          requestedByUserId: currentUser.id,
          template: workflow.template,
          configurationJson: workflow.configurationJson
        }
      }
    });

    await this.audit.record({
      organizationId: currentUser.organizationId,
      workflowRunId: run.id,
      agentId: run.agentId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType: AuditEventType.WORKFLOW_RUN_CREATED,
      eventDataJson: {
        workflowId: workflow.id,
        workflowRunId: run.id,
        status: run.status,
        template: workflow.template
      }
    });

    const queued = await this.queue.enqueueStart({
      workflowRunId: run.id,
      workflowId: workflow.id,
      organizationId: currentUser.organizationId,
      agentId: workflow.agentId,
      vendorId: workflow.vendorId,
      template: workflow.template
    });

    await this.recordWorkflowAudit(currentUser, workflow, AuditEventType.WORKFLOW_RUN_REQUESTED, {
      workflowId: workflow.id,
      workflowRunId: run.id,
      queueJobId: queued.jobId,
      template: workflow.template
    });

    return {
      data: {
        run: toWorkflowRunDto(run),
        queueJobId: queued.jobId
      }
    };
  }

  private async findWorkflowInOrganization(organizationId: string | undefined, id: string): Promise<Workflow> {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const workflow = await this.database.client.workflow.findFirst({
      where: { id, organizationId }
    });

    if (!workflow) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow was not found.');
    }

    return workflow;
  }

  private async assertActiveAgent(organizationId: string, agentId: string): Promise<void> {
    const agent = await this.database.client.agent.findFirst({
      where: { id: agentId, organizationId }
    });

    if (!agent) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Workflow agent belongs to another organization.');
    }

    if (agent.status !== AgentStatus.ACTIVE) {
      throw new DomainError(DomainErrorCode.AgentNotActive, 'Agent must be active to start workflow runs.');
    }
  }

  private async assertActiveVendor(organizationId: string, vendorId: string): Promise<void> {
    const vendor = await this.database.client.vendor.findFirst({
      where: { id: vendorId, organizationId }
    });

    if (!vendor) {
      throw new DomainError(DomainErrorCode.OrganizationIsolationViolation, 'Workflow vendor belongs to another organization.');
    }

    if (vendor.deletedAt) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Deleted vendors cannot be used by workflows.');
    }
  }

  private async assertActivePolicy(organizationId: string, agentId: string): Promise<void> {
    const policy = await this.database.client.policy.findFirst({
      where: {
        organizationId,
        agentId,
        type: PolicyType.AGENT_POLICY_BUNDLE,
        status: PolicyStatus.ACTIVE
      },
      select: { id: true }
    });

    if (!policy) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow agent requires an active policy bundle.');
    }
  }

  private async assertCredentialGrantForConfig(
    organizationId: string,
    agentId: string,
    vendorId: string,
    configurationJson: Prisma.JsonValue | Prisma.InputJsonObject
  ): Promise<void> {
    if (!configurationJson || typeof configurationJson !== 'object' || Array.isArray(configurationJson)) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow configuration must be an object.');
    }

    const credentialId = configurationJson.credentialId;
    if (typeof credentialId !== 'string') {
      return;
    }

    const credential = await this.database.client.credential.findFirst({
      where: {
        id: credentialId,
        organizationId,
        vendorId,
        status: { not: CredentialStatus.REVOKED }
      },
      select: { id: true }
    });

    if (!credential) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow credential must be active and belong to the selected vendor.');
    }

    const grant = await this.database.client.credentialAgentGrant.findFirst({
      where: {
        credentialId,
        agentId,
        revokedAt: null
      },
      select: { id: true }
    });

    if (!grant) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Workflow credential is not granted to the selected agent.');
    }
  }

  private async recordWorkflowAudit(
    currentUser: ContextUser,
    workflow: Workflow,
    eventType: AuditEventType,
    eventDataJson: Prisma.InputJsonObject
  ): Promise<void> {
    await this.audit.record({
      organizationId: currentUser.organizationId,
      agentId: workflow.agentId,
      actorType: AuditActorType.USER,
      actorId: currentUser.id,
      eventType,
      eventDataJson
    });
  }
}
