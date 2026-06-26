import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from "@nestjs/common";
import { DomainErrorCode, isDomainError } from "@agentpass/domain";
import { RequestContextService } from "../request-context/request-context.service.js";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
};

type JsonResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json(body: ErrorResponse): void;
  };
};

function asErrorMessage(error: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return "Internal Server Error";
  }
  return error instanceof Error ? error.message : "Unexpected server error";
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    const requestId = this.requestContext.getRequestId();
    if (requestId) {
      response.setHeader('x-request-id', requestId);
    }

    if (isDomainError(exception)) {
      response.status(statusForDomainError(exception.code)).json({
        error: {
          code: exception.code,
          message: exception.message,
          requestId,
          details: process.env.NODE_ENV === 'production' ? undefined : exception.details,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json({
        error: {
          code: httpCodeFor(exception),
          message: httpMessageFor(exception),
          requestId,
        },
      });
      return;
    }

    this.logger.error(
      `Unhandled exception for request ${requestId ?? "unknown"}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: asErrorMessage(exception),
        requestId,
      },
    });
  }
}

function statusForDomainError(code: DomainErrorCode): number {
  switch (code) {
    case DomainErrorCode.NotFound:
      return HttpStatus.NOT_FOUND;
    case DomainErrorCode.PermissionDenied:
    case DomainErrorCode.OrganizationIsolationViolation:
      return HttpStatus.FORBIDDEN;
    case DomainErrorCode.ValidationFailed:
      return HttpStatus.BAD_REQUEST;
    case DomainErrorCode.RateLimited:
      return HttpStatus.TOO_MANY_REQUESTS;
    case DomainErrorCode.ApprovalRequired:
      return HttpStatus.CONFLICT;
    default:
      return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}

function httpCodeFor(exception: HttpException): string {
  const body = exception.getResponse();

  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (typeof error === "string") {
      return error.toUpperCase().replaceAll(" ", "_");
    }
  }

  return (
    exception.name
      .toUpperCase()
      .replaceAll("EXCEPTION", "")
      .replaceAll(" ", "_") || "HTTP_ERROR"
  );
}

function httpMessageFor(exception: HttpException): string {
  const body = exception.getResponse();

  if (typeof body === "object" && body !== null && "message" in body) {
    const message = body.message;
    return Array.isArray(message) ? message.join(", ") : String(message);
  }

  return exception.message;
}
