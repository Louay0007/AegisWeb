import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VendorSandboxModule } from '../apps/vendor-sandbox/src/vendor-sandbox.module.js';

describe('phase 21 vendor sandbox backend', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VendorSandboxModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves health, login, dashboard, and billing pages for browser workflows', async () => {
    const health = await request(app.getHttpServer()).get('/health').expect(200);
    expect(health.body).toMatchObject({
      service: 'vendor-sandbox',
      state: 'ok'
    });

    const login = await request(app.getHttpServer()).get('/login').expect(200);
    expect(login.text).toContain('Acme Analytics');
    expect(login.text).toContain('data-testid="login-form"');
    expect(login.text).toContain('name="password" type="password"');

    const dashboard = await request(app.getHttpServer()).get('/dashboard').expect(200);
    expect(dashboard.text).toContain('Acme Analytics Dashboard');
    expect(dashboard.text).toContain('id="billing-link"');
    expect(dashboard.text).toContain('id="admin-users-link"');

    const billing = await request(app.getHttpServer()).get('/billing').expect(200);
    expect(billing.text).toContain('data-testid="renewal-data"');
    expect(billing.text).toContain('data-renewal-monthly-price-cents="110000"');
    expect(billing.text).toContain('data-testid="downgrade-form"');
    expect(billing.text).toContain('data-testid="cancel-form"');
  });

  it('logs in with valid sandbox credentials and rejects invalid credentials', async () => {
    const success = await request(app.getHttpServer())
      .post('/login')
      .send({
        email: 'finance@northstarlabs.dev',
        password: 'acme-local-password'
      })
      .expect(201);

    expect(success.headers['set-cookie']?.[0]).toContain('sandbox_session=');
    expect(success.body).toMatchObject({
      ok: true,
      redirectTo: '/dashboard',
      vendorName: 'Acme Analytics'
    });

    const failure = await request(app.getHttpServer())
      .post('/login')
      .send({
        email: 'finance@northstarlabs.dev',
        password: 'wrong-password'
      })
      .expect(401);

    expect(failure.body).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_LOGIN'
      }
    });
  });

  it('returns deterministic renewal data for extraction', async () => {
    const response = await request(app.getHttpServer()).get('/billing').query({ format: 'json' }).expect(200);

    expect(response.body).toEqual({
      vendorName: 'Acme Analytics',
      currentPlan: 'Growth',
      currentMonthlyPriceCents: 80000,
      renewalMonthlyPriceCents: 110000,
      renewalDate: '2026-07-15',
      seatCount: 28,
      unusedSeats: 5,
      estimatedMonthlySavingsCents: 48000,
      recommendation: 'downgrade_to_starter'
    });
  });

  it('downloads a deterministic latest invoice artifact', async () => {
    const response = await request(app.getHttpServer()).get('/billing/invoices/latest.pdf').expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('acme-latest-invoice.pdf');
    const invoice = Buffer.from(response.body as Buffer).toString('utf8');
    expect(invoice).toContain('AgentPass Local Vendor Sandbox Invoice');
    expect(invoice).toContain('Invoice: INV-ACME-2026-0007');
    expect(invoice).toContain('Renewal monthly cents: 110000');
  });

  it('requires a form-style downgrade submit and returns a deterministic result', async () => {
    const response = await request(app.getHttpServer())
      .post('/billing/downgrade')
      .type('form')
      .send({
        targetPlan: 'Starter'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      ok: true,
      action: 'downgrade_plan',
      fromPlan: 'Growth',
      toPlan: 'Starter',
      effectiveAt: '2026-07-15',
      estimatedMonthlySavingsCents: 48000
    });
  });

  it('exposes destructive cancel and admin invite actions for later policy denial tests', async () => {
    const cancel = await request(app.getHttpServer()).post('/billing/cancel').expect(201);
    expect(cancel.body).toMatchObject({
      ok: true,
      action: 'cancel_subscription'
    });

    const admin = await request(app.getHttpServer()).get('/admin/users').expect(200);
    expect(admin.text).toContain('data-testid="invite-admin-form"');
    expect(admin.text).toContain('id="invite-admin"');
    expect(admin.text).toContain('finance@northstarlabs.dev');

    const invite = await request(app.getHttpServer())
      .post('/admin/users/invite')
      .type('form')
      .send({
        email: 'external-admin@example.test',
        role: 'admin'
      })
      .expect(201);

    expect(invite.body).toMatchObject({
      ok: true,
      action: 'invite_user',
      invitedEmail: 'external-admin@example.test',
      role: 'admin'
    });
  });
});
