import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AgentActivityService } from './agent-activity.service.js';
import { AgentIdentifierService } from './agent-identifier.service.js';
import { AgentStatusService } from './agent-status.service.js';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';

@Module({
  imports: [AuditModule, DatabaseModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentIdentifierService, AgentActivityService, AgentStatusService],
  exports: [AgentsService, AgentIdentifierService, AgentActivityService, AgentStatusService]
})
export class AgentsModule {}
