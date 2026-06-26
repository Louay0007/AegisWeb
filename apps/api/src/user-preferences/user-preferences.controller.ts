import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { CurrentUser } from '../request-context/current-user.decorator.js';
import { ContextUser } from '../request-context/types.js';
import { UserPreferencesService } from './user-preferences.service.js';

const updateNotificationPreferencesSchema = z.object({
  approvalRequests: z.boolean().optional(),
  runCompletions: z.boolean().optional(),
  failures: z.boolean().optional(),
  slackWebhookUrl: z.string().url().nullable().optional()
});

@Controller('user/preferences')
export class UserPreferencesController {
  constructor(@Inject(UserPreferencesService) private readonly preferences: UserPreferencesService) {}

  @Get('notifications')
  getNotifications(@CurrentUser() currentUser: ContextUser | undefined) {
    return this.preferences.getNotificationPreferences(currentUser);
  }

  @Patch('notifications')
  updateNotifications(@CurrentUser() currentUser: ContextUser | undefined, @Body() body: unknown) {
    const parsed = updateNotificationPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError(DomainErrorCode.ValidationFailed, 'Invalid notification preferences request.');
    }
    return this.preferences.updateNotificationPreferences(currentUser, parsed.data);
  }
}
