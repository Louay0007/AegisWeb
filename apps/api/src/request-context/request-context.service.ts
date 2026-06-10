import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { ContextUser, RequestContextState } from './types.js';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextState>();

  run<T>(context: RequestContextState, handler: () => T): T {
    return this.storage.run(context, handler);
  }

  getStore(): RequestContextState | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string | undefined {
    return this.getStore()?.requestId;
  }

  getCurrentUser(): ContextUser | undefined {
    return this.getStore()?.user;
  }

  getOrganizationId(): string | undefined {
    return this.getStore()?.organizationId ?? this.getStore()?.user?.organizationId;
  }

  setAuthenticatedUser(user: ContextUser): void {
    const store = this.getStore();

    if (!store) {
      return;
    }

    store.user = user;
    store.organizationId = user.organizationId;
  }
}
