import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../apps/api/src/app.module.js';
import { setupOpenApi } from '../apps/api/src/docs/openapi.js';

describe('phase 29 API documentation and contracts', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    setupOpenApi(app);
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger UI and generated OpenAPI JSON', async () => {
    const docs = await request(app.getHttpServer()).get('/docs').expect(200);
    expect(docs.text).toContain('Swagger UI');

    const json = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(json.body.openapi).toMatch(/^3\./);
    expect(json.body.info).toMatchObject({
      title: 'AgentPass API',
      version: '0.29.0'
    });
  });

  it('documents all backend controller surfaces needed by Angular', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const paths = Object.keys(response.body.paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/health',
        '/health/ready',
        '/auth/login',
        '/auth/me',
        '/organization',
        '/users',
        '/agents',
        '/vendors',
        '/policies',
        '/credentials',
        '/workflows',
        '/workflow-runs',
        '/approvals',
        '/files/{id}',
        '/audit-events',
        '/receipts',
        '/internal/workers/runs/{runId}/approval-requests'
      ])
    );
  });

  it('documents auth schemes, protected route security, worker route security, and public routes', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const document = response.body;

    expect(document.components.securitySchemes).toMatchObject({
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      workerToken: {
        type: 'apiKey',
        in: 'header',
        name: 'x-worker-token'
      }
    });
    expect(document.paths['/agents'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(document.paths['/auth/login'].post.security).toEqual([]);
    expect(document.paths['/health'].get.security).toEqual([]);
    expect(document.paths['/internal/workers/runs/{runId}/approval-requests'].post.security).toEqual([
      { workerToken: [] }
    ]);
  });

  it('documents standard envelopes, pagination, and error responses', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const document = response.body;

    expect(document.components.schemas).toMatchObject({
      DataEnvelope: expect.any(Object),
      PaginatedEnvelope: expect.any(Object),
      PaginationMeta: {
        type: 'object',
        required: ['total', 'limit', 'offset']
      },
      StandardErrorResponse: expect.any(Object)
    });
    expect(document.components.responses.StandardError.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/StandardErrorResponse'
    });
    expect(document.components.parameters).toMatchObject({
      LimitQuery: expect.any(Object),
      OffsetQuery: expect.any(Object)
    });
    expect(document.paths['/receipts'].get.parameters).toEqual(
      expect.arrayContaining([
        { $ref: '#/components/parameters/LimitQuery' },
        { $ref: '#/components/parameters/OffsetQuery' }
      ])
    );
    expect(document.paths['/receipts'].get.responses['403']).toEqual({
      $ref: '#/components/responses/StandardError'
    });
  });

  it('keeps runtime errors in the documented standard envelope', async () => {
    const response = await request(app.getHttpServer()).get('/agents').set('x-request-id', 'req_phase29').expect(403);

    expect(response.body).toEqual({
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Authentication required.',
        requestId: 'req_phase29',
        details: {}
      }
    });
  });
});
