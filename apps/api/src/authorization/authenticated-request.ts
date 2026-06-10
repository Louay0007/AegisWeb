import { AccessTokenPayload } from '../auth/token.service.js';
import { HeaderValue, RequestContextCarrier } from '../request-context/types.js';

export type AuthenticatedUser = {
  id: string;
  organizationId: string;
  role: string;
  email: string;
};

export type AuthorizationRequest = RequestContextCarrier & {
  headers?: Record<string, HeaderValue>;
  url?: string;
  body?: unknown;
  auth?: {
    accessToken?: AccessTokenPayload;
    user?: AuthenticatedUser;
    worker?: {
      organizationId: string;
      workflowRunId: string;
      expiresAt: number;
    };
  };
};
