import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

const PUBLIC_OPERATIONS = new Set([
  'GET /health',
  'GET /health/ready',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout'
]);

const ERROR_RESPONSES = {
  400: { $ref: '#/components/responses/StandardError' },
  401: { $ref: '#/components/responses/StandardError' },
  403: { $ref: '#/components/responses/StandardError' },
  404: { $ref: '#/components/responses/StandardError' },
  422: { $ref: '#/components/responses/StandardError' },
  500: { $ref: '#/components/responses/StandardError' }
} as const;

export function setupOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('AgentPass API')
    .setDescription(
      'Local AgentPass control-plane API for organizations, agents, vendors, policies, credentials, workflow runs, approvals, receipts, files, audit events, and worker internals.'
    )
    .setVersion('0.29.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token returned by the local auth endpoints.'
      },
      'bearerAuth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-worker-token',
        description: 'Internal worker token for worker-only endpoints.'
      },
      'workerToken'
    )
    .addServer('http://localhost:3000', 'Local API')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`
  });
  enrichDocument(document);

  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: {
      persistAuthorization: process.env.NODE_ENV !== 'production'
    }
  });

  return document;
}

function enrichDocument(document: OpenAPIObject): void {
  document.tags = [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Organization' },
    { name: 'Users' },
    { name: 'Agents' },
    { name: 'Vendors' },
    { name: 'Policies' },
    { name: 'Credentials' },
    { name: 'Workflows' },
    { name: 'WorkflowRuns' },
    { name: 'ActionAttempts' },
    { name: 'Approvals' },
    { name: 'Files' },
    { name: 'Audit' },
    { name: 'Receipts' },
    { name: 'InternalWorker' }
  ];
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      DataEnvelope: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            description: 'Endpoint payload. Shape depends on the operation.'
          }
        }
      },
      PaginationMeta: {
        type: 'object',
        required: ['total', 'limit', 'offset'],
        properties: {
          total: { type: 'integer', minimum: 0 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 }
        }
      },
      PaginatedEnvelope: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            items: {}
          },
          meta: { $ref: '#/components/schemas/PaginationMeta' }
        }
      },
      StandardErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'PERMISSION_DENIED' },
              message: { type: 'string', example: 'Authentication required.' },
              requestId: { type: 'string', example: 'req_123' },
              details: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        }
      }
    },
    responses: {
      ...document.components?.responses,
      StandardError: {
        description: 'Standard API error envelope.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/StandardErrorResponse' }
          }
        }
      },
      DataEnvelope: {
        description: 'Standard single-resource response envelope.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/DataEnvelope' }
          }
        }
      },
      PaginatedEnvelope: {
        description: 'Standard paginated list response envelope.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PaginatedEnvelope' }
          }
        }
      }
    },
    parameters: {
      ...document.components?.parameters,
      LimitQuery: {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        description: 'Maximum number of records to return.'
      },
      OffsetQuery: {
        name: 'offset',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 0, default: 0 },
        description: 'Number of records to skip.'
      }
    }
  };

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem?.[method];
      if (!operation) {
        continue;
      }

      operation.responses = {
        ...(operation.responses ?? {}),
        ...Object.fromEntries(
          Object.entries(ERROR_RESPONSES).filter(([status]) => !operation.responses?.[status])
        )
      };

      operation.security = securityFor(method.toUpperCase(), path);
      operation.tags = operation.tags?.length ? operation.tags : [tagForPath(path)];

      if (method === 'get' && isListPath(path)) {
        operation.parameters = [
          ...asArray(operation.parameters),
          { $ref: '#/components/parameters/LimitQuery' },
          { $ref: '#/components/parameters/OffsetQuery' }
        ];
        operation.responses = {
          200: { $ref: '#/components/responses/PaginatedEnvelope' },
          ...operation.responses
        };
      } else if (!operation.responses?.[200] && !operation.responses?.[201]) {
        operation.responses = {
          200: { $ref: '#/components/responses/DataEnvelope' },
          ...operation.responses
        };
      }
    }
  }
}

function securityFor(method: string, path: string): Array<Record<string, string[]>> {
  if (PUBLIC_OPERATIONS.has(`${method} ${path}`)) {
    return [];
  }

  if (path.startsWith('/internal/')) {
    return [{ workerToken: [] }];
  }

  return [{ bearerAuth: [] }];
}

function tagForPath(path: string): string {
  const segment = path.split('/').filter(Boolean)[0] ?? 'root';
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function isListPath(path: string): boolean {
  return !path.includes('{') && !path.startsWith('/health') && path !== '/auth/me';
}

function asArray<T>(value: T[] | undefined): T[] {
  return value ?? [];
}
