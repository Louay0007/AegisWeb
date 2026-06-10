import { Injectable } from '@nestjs/common';
import {
  ActionType,
  DomainError,
  DomainErrorCode,
  WorkflowTemplate,
  WORKFLOW_TEMPLATE_DEFINITIONS
} from '@agentpass/domain';

@Injectable()
export class WorkflowTemplateService {
  get(template: WorkflowTemplate) {
    const definition = WORKFLOW_TEMPLATE_DEFINITIONS[template];

    if (!definition) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Workflow template must be known.');
    }

    return definition;
  }

  list() {
    return { data: Object.values(WORKFLOW_TEMPLATE_DEFINITIONS) };
  }

  requiresLogin(template: WorkflowTemplate): boolean {
    return this.get(template).expectedActions.includes(ActionType.CredentialInjection);
  }
}
