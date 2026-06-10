import { Inject, Injectable } from '@nestjs/common';
import { Prisma, WorkflowRunStatus } from '@prisma/client';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { toAuditEventDto } from '../audit/audit.types.js';
import { DatabaseService } from '../database/database.service.js';
import { toWorkflowRunDetailDto } from './workflow-runs.types.js';

export type WorkflowRunListQuery = {
  workflowId?: string;
  agentId?: string;
  vendorId?: string;
  status?: WorkflowRunStatus;
  limit: number;
  offset: number;
};

@Injectable()
export class WorkflowRunQueryService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(organizationId: string | undefined, query: WorkflowRunListQuery) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const where: Prisma.WorkflowRunWhereInput = {
      organizationId,
      workflowId: query.workflowId,
      agentId: query.agentId,
      vendorId: query.vendorId,
      status: query.status
    };

    const [runs, total] = await Promise.all([
      this.database.client.workflowRun.findMany({
        where,
        include: {
          workflow: { select: { id: true, name: true, template: true } },
          agent: { select: { id: true, name: true, identifier: true } },
          vendor: { select: { id: true, name: true, website: true } },
          actionAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          files: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          approvalRequests: {
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          receipt: {
            select: {
              id: true,
              finalStatus: true,
              summary: true,
              createdAt: true
            }
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit,
        skip: query.offset
      }),
      this.database.client.workflowRun.count({ where })
    ]);

    return {
      data: runs.map(toWorkflowRunDetailDto),
      meta: {
        total,
        limit: query.limit,
        offset: query.offset
      }
    };
  }

  async get(organizationId: string | undefined, id: string) {
    const run = await this.findRunDetail(organizationId, id);
    return { data: toWorkflowRunDetailDto(run) };
  }

  async events(organizationId: string | undefined, id: string) {
    await this.findRunInOrganization(organizationId, id);

    const events = await this.database.client.auditEvent.findMany({
      where: {
        organizationId,
        workflowRunId: id
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
    });

    return { data: events.map(toAuditEventDto) };
  }

  async findRunInOrganization(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const run = await this.database.client.workflowRun.findFirst({
      where: { id, organizationId }
    });

    if (!run) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }

    return run;
  }

  private async findRunDetail(organizationId: string | undefined, id: string) {
    if (!organizationId) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Organization context is required.');
    }

    const run = await this.database.client.workflowRun.findFirst({
      where: { id, organizationId },
      include: {
        workflow: { select: { id: true, name: true, template: true } },
        agent: { select: { id: true, name: true, identifier: true } },
        vendor: { select: { id: true, name: true, website: true } },
        actionAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        files: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        approvalRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        receipt: {
          select: {
            id: true,
            finalStatus: true,
            summary: true,
            createdAt: true
          }
        }
      }
    });

    if (!run) {
      throw new DomainError(DomainErrorCode.NotFound, 'Workflow run was not found.');
    }

    return run;
  }
}
