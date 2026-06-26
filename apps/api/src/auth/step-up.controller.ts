import { Body, Controller, Inject, Post } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { stepUpSchema } from './dto.js';
import { StepUpService } from './step-up.service.js';

@Controller('auth')
export class StepUpController {
  constructor(@Inject(StepUpService) private readonly stepUpService: StepUpService) {}

  @Post('step-up')
  stepUp(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = stepUpSchema.safeParse(body);
    if (!parsed.success) throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid step-up request.');
    return this.stepUpService.issue(currentUser, parsed.data);
  }
}
