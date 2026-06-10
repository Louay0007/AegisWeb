export type ContextUser = {
  id: string;
  organizationId: string;
  role?: string;
};

export type RequestContextState = {
  requestId: string;
  user?: ContextUser;
  organizationId?: string;
};

export type HeaderValue = string | string[] | undefined;

export type RequestContextCarrier = {
  requestContext?: RequestContextState;
  headers?: Record<string, HeaderValue>;
};

export type ResponseHeaderWriter = {
  setHeader(name: string, value: string): void;
};

export function readHeader(headers: Record<string, HeaderValue> | undefined, name: string): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
