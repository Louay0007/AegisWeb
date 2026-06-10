import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppModule } from '../apps/api/src/app.module.js';
import { HealthService } from '../apps/api/src/health/health.service.js';
import { createWorkerApplicationContext } from '../apps/worker/src/main.js';
import { WorkerService } from '../apps/worker/src/worker.service.js';
import { VendorSandboxModule } from '../apps/vendor-sandbox/src/vendor-sandbox.module.js';
import { getAuditStatus } from '@agentpass/audit';
import { getBrowserRuntimeStatus } from '@agentpass/browser-runtime';
import { SERVICE_NAMES } from '@agentpass/domain';
import { getPolicyEngineStatus } from '@agentpass/policy-engine';
import { expectNoPlaintextSecret } from '@agentpass/testing';
import { getVaultStatus } from '@agentpass/vault';

describe('phase 0 backend foundation', () => {
  it('boots the API Nest application and exposes liveness metadata', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();

    const health = app.get(HealthService).getLiveness();

    expect(health.service).toBe(SERVICE_NAMES.api);
    expect(health.state).toBe('ok');
    expect(health.version).toBe('0.0.0');
    await request(app.getHttpServer()).get('/health').expect(200);

    await app.close();
  });

  it('boots the worker application context', async () => {
    const app = await createWorkerApplicationContext();
    const worker = app.get(WorkerService);

    expect(worker.getStatus()).toMatchObject({
      service: SERVICE_NAMES.worker,
      state: 'ok',
      mode: 'phase-19-worker-foundation'
    });

    await app.close();
  });

  it('boots the vendor sandbox Nest application', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VendorSandboxModule]
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();

    await app.init();
    expect(app.getHttpServer()).toBeDefined();
    await app.close();
  });

  it('exports placeholder status from every backend foundation library', () => {
    expect(getPolicyEngineStatus()).toEqual({
      ready: true,
      mode: 'phase-11-policy-engine'
    });
    expect(getVaultStatus()).toEqual({
      ready: true,
      encryption: 'aes-256-gcm'
    });
    expect(getAuditStatus()).toEqual({
      ready: true,
      hashChain: 'phase-0-placeholder'
    });
    expect(getBrowserRuntimeStatus()).toEqual({
      ready: true,
      runtime: 'playwright-controlled-runtime'
    });
  });

  it('keeps the testing secret assertion available for later modules', () => {
    expect(() => expectNoPlaintextSecret('safe serialized output')).not.toThrow();
    expect(() => expectNoPlaintextSecret('leaked acme-local-password value')).toThrow(
      /Secret leaked/
    );
  });
});
