import { Inject, Injectable } from '@nestjs/common';
import {
  DomainError,
  DomainErrorCode,
  WorkflowTemplate
} from '@agentpass/domain';
import { WorkflowTemplateService } from './workflow-template.service.js';

@Injectable()
export class WorkflowValidationService {
  constructor(@Inject(WorkflowTemplateService) private readonly templates: WorkflowTemplateService) {}

  validateConfiguration(template: WorkflowTemplate, configurationJson: Record<string, unknown>, vendorId: string): void {
    const definition = this.templates.get(template);

    for (const input of definition.requiredInputs) {
      if (input.name === 'vendorId') {
        if (!vendorId) {
          throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow vendor is required.');
        }
        continue;
      }

      const value = configurationJson[input.name];
      if (input.required && (value === undefined || value === null || value === '')) {
        throw new DomainError(DomainErrorCode.ValidationFailed, `Workflow configuration requires ${input.name}.`);
      }
    }

    if (this.templates.requiresLogin(template)) {
      const credentialId = configurationJson.credentialId;
      if (typeof credentialId !== 'string' || credentialId.length === 0) {
        throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow configuration requires credentialId for login templates.');
      }
    }

    if (
      template === WorkflowTemplate.PlanDowngradeRequest &&
      (typeof configurationJson.targetPlan !== 'string' || configurationJson.targetPlan.trim().length === 0)
    ) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow configuration requires targetPlan.');
    }
  }
}
