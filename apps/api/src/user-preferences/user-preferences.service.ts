import { Inject, Injectable } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@agentpass/domain';
import { DatabaseService } from '../database/database.service.js';
import { ContextUser } from '../request-context/types.js';

export type UpdateNotificationPreferencesInput = {
  approvalRequests?: boolean;
  runCompletions?: boolean;
  failures?: boolean;
};

export type NotificationPreferencesDto = {
  approvalRequests: boolean;
  runCompletions: boolean;
  failures: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferencesDto = {
  approvalRequests: true,
  runCompletions: false,
  failures: true
};

@Injectable()
export class UserPreferencesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getNotificationPreferences(currentUser: ContextUser | undefined) {
    const user = this.requireUser(currentUser);
    const prefs = await this.database.client.userNotificationPreference.findUnique({
      where: { userId: user.id }
    });

    return { data: prefs ? toDto(prefs) : DEFAULT_PREFERENCES };
  }

  async updateNotificationPreferences(currentUser: ContextUser | undefined, input: UpdateNotificationPreferencesInput) {
    const user = this.requireUser(currentUser);
    const prefs = await this.database.client.userNotificationPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        approvalRequests: input.approvalRequests ?? DEFAULT_PREFERENCES.approvalRequests,
        runCompletions: input.runCompletions ?? DEFAULT_PREFERENCES.runCompletions,
        failures: input.failures ?? DEFAULT_PREFERENCES.failures
      },
      update: {
        ...(input.approvalRequests === undefined ? {} : { approvalRequests: input.approvalRequests }),
        ...(input.runCompletions === undefined ? {} : { runCompletions: input.runCompletions }),
        ...(input.failures === undefined ? {} : { failures: input.failures })
      }
    });

    return { data: toDto(prefs) };
  }

  private requireUser(currentUser: ContextUser | undefined): ContextUser {
    if (!currentUser) {
      throw new DomainError(DomainErrorCode.PermissionDenied, 'Authentication required.');
    }
    return currentUser;
  }
}

function toDto(prefs: {
  approvalRequests: boolean;
  runCompletions: boolean;
  failures: boolean;
}): NotificationPreferencesDto {
  return {
    approvalRequests: prefs.approvalRequests,
    runCompletions: prefs.runCompletions,
    failures: prefs.failures
  };
}
