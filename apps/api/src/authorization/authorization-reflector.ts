import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserRole } from '@agentpass/domain';
import { AUTHORIZATION_METADATA } from './authorization-metadata.js';

@Injectable()
export class AuthorizationReflector {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  isPublic(context: ExecutionContext): boolean {
    return this.getBoolean(AUTHORIZATION_METADATA.public, context);
  }

  isInternal(context: ExecutionContext): boolean {
    return this.getBoolean(AUTHORIZATION_METADATA.internal, context);
  }

  requiredRoles(context: ExecutionContext): UserRole[] {
    return this.getArray<UserRole>(AUTHORIZATION_METADATA.roles, context);
  }

  requiredPermissions(context: ExecutionContext): Permission[] {
    return this.getArray<Permission>(AUTHORIZATION_METADATA.permissions, context);
  }

  requiresStepUp(context: ExecutionContext): boolean {
    return this.getBoolean(AUTHORIZATION_METADATA.stepUp, context);
  }

  private getBoolean(key: string, context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]) ?? false
    );
  }

  private getArray<T>(key: string, context: ExecutionContext): T[] {
    return this.reflector.getAllAndOverride<T[]>(key, [context.getHandler(), context.getClass()]) ?? [];
  }
}
