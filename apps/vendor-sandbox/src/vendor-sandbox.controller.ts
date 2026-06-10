import { Body, Controller, Get, Header, Post, Query, Res } from '@nestjs/common';
import { nowIso, SERVICE_NAMES } from '@agentpass/domain';
import { latestInvoiceText, sandboxVendor } from './vendor-sandbox.data.js';
import { adminUsersPage, billingPage, dashboardPage, loginPage, renewalData } from './vendor-sandbox.views.js';

type SandboxResponse = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  status(code: number): SandboxResponse;
  type(contentType: string): SandboxResponse;
  setHeader(name: string, value: string | number): void;
  send(body: string): void;
};

type LoginBody = {
  email?: string;
  password?: string;
};

type DowngradeBody = {
  targetPlan?: string;
};

type InviteBody = {
  email?: string;
  role?: string;
};

@Controller()
export class VendorSandboxController {
  @Get('health')
  getHealth() {
    return {
      service: SERVICE_NAMES.vendorSandbox,
      state: 'ok',
      checkedAt: nowIso()
    };
  }

  @Get()
  @Header('content-type', 'text/html')
  getHome(): string {
    return dashboardPage();
  }

  @Get('login')
  @Header('content-type', 'text/html')
  getLoginPage(): string {
    return loginPage();
  }

  @Post('login')
  login(@Body() body: LoginBody, @Res({ passthrough: true }) response: SandboxResponse) {
    const email = body.email ?? '';
    const password = body.password ?? '';

    if (email === sandboxVendor.validUsername && password === sandboxVendor.validPassword) {
      response.cookie('sandbox_session', 'acme-local-session', {
        httpOnly: true,
        sameSite: 'lax'
      });

      return {
        ok: true,
        redirectTo: '/dashboard',
        vendorName: sandboxVendor.vendorName
      };
    }

    response.status(401);
    return {
      ok: false,
      error: {
        code: 'INVALID_LOGIN',
        message: 'Invalid sandbox credentials.'
      }
    };
  }

  @Get('dashboard')
  @Header('content-type', 'text/html')
  getDashboard(): string {
    return dashboardPage();
  }

  @Get('billing')
  getBilling(@Query('format') format: string | undefined, @Res({ passthrough: true }) response: SandboxResponse) {
    if (format === 'json') {
      return renewalData();
    }

    response.type('text/html');
    return billingPage();
  }

  @Get('billing/invoices/latest.pdf')
  getLatestInvoice(@Res() response: SandboxResponse): void {
    const invoice = latestInvoiceText();

    response.setHeader('content-type', 'application/pdf');
    response.setHeader('content-disposition', 'attachment; filename="acme-latest-invoice.pdf"');
    response.setHeader('content-length', Buffer.byteLength(invoice));
    response.send(invoice);
  }

  @Post('billing/downgrade')
  downgrade(@Body() body: DowngradeBody) {
    const targetPlan = body.targetPlan || sandboxVendor.targetPlan;

    return {
      ok: true,
      action: 'downgrade_plan',
      fromPlan: sandboxVendor.currentPlan,
      toPlan: targetPlan,
      confirmation: `Plan downgrade prepared from ${sandboxVendor.currentPlan} to ${targetPlan}.`,
      effectiveAt: '2026-07-15',
      estimatedMonthlySavingsCents: sandboxVendor.estimatedMonthlySavingsCents
    };
  }

  @Post('billing/cancel')
  cancel() {
    return {
      ok: true,
      action: 'cancel_subscription',
      warning: 'This destructive action exists for policy denial and approval tests.',
      effectiveAt: '2026-07-15'
    };
  }

  @Get('admin/users')
  @Header('content-type', 'text/html')
  getAdminUsers(): string {
    return adminUsersPage();
  }

  @Post('admin/users/invite')
  inviteAdmin(@Body() body: InviteBody) {
    return {
      ok: true,
      action: 'invite_user',
      invitedEmail: body.email ?? 'new-admin@example.test',
      role: body.role ?? 'admin',
      warning: 'Admin invitation is intentionally exposed so AgentPass policy can deny it.'
    };
  }
}
