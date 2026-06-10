export type ApiErrorShape = {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
  status?: number;
};

export class ApiError extends Error {
  code: string;
  requestId?: string;
  details?: Record<string, unknown>;
  status?: number;

  constructor({ code, message, requestId, details, status }: ApiErrorShape) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown) {
  if (isApiError(error)) {
    return error.requestId ? `${error.message} Request ID: ${error.requestId}.` : error.message;
  }

  return error instanceof Error ? error.message : "Unexpected error.";
}
