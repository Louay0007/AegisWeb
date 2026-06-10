import { sandboxUsers, sandboxVendor } from './vendor-sandbox.data.js';

export function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #172033; }
      main { max-width: 920px; margin: 0 auto; }
      label { display: block; margin: 12px 0; }
      input, select, button { font: inherit; padding: 8px 10px; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; }
      th, td { border: 1px solid #d8dee9; padding: 8px; text-align: left; }
      .danger { color: #9f1239; }
      .metric { display: inline-block; margin: 8px 16px 8px 0; }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

export function loginPage(error?: string): string {
  return pageShell(
    'Acme Analytics Login',
    `<h1>Acme Analytics</h1>
    <p>Local deterministic SaaS vendor sandbox.</p>
    ${error ? `<p role="alert" class="danger" data-testid="login-error">${escapeHtml(error)}</p>` : ''}
    <form method="post" action="/login" data-testid="login-form">
      <label>Email <input id="email" name="email" type="email" autocomplete="username" /></label>
      <label>Password <input id="password" name="password" type="password" autocomplete="current-password" /></label>
      <button id="login-submit" type="submit">Sign in</button>
    </form>`
  );
}

export function dashboardPage(): string {
  return pageShell(
    'Acme Analytics Dashboard',
    `<h1>Acme Analytics Dashboard</h1>
    <nav>
      <a href="/billing" id="billing-link">Billing</a>
      <a href="/admin/users" id="admin-users-link">Admin users</a>
    </nav>
    <section aria-label="Account summary">
      <p data-testid="vendor-name">${sandboxVendor.vendorName}</p>
      <p data-testid="current-plan">${sandboxVendor.currentPlan}</p>
    </section>`
  );
}

export function billingPage(): string {
  return pageShell(
    'Acme Analytics Billing',
    `<h1>Billing</h1>
    <section id="renewal-data" data-testid="renewal-data"
      data-vendor-name="${sandboxVendor.vendorName}"
      data-current-plan="${sandboxVendor.currentPlan}"
      data-current-monthly-price-cents="${sandboxVendor.currentMonthlyPriceCents}"
      data-renewal-monthly-price-cents="${sandboxVendor.renewalMonthlyPriceCents}"
      data-renewal-date="${sandboxVendor.renewalDate}"
      data-seat-count="${sandboxVendor.seatCount}"
      data-unused-seats="${sandboxVendor.unusedSeats}"
      data-estimated-monthly-savings-cents="${sandboxVendor.estimatedMonthlySavingsCents}">
      <span class="metric">Plan: <strong>${sandboxVendor.currentPlan}</strong></span>
      <span class="metric">Seats: <strong>${sandboxVendor.seatCount}</strong></span>
      <span class="metric">Unused seats: <strong>${sandboxVendor.unusedSeats}</strong></span>
      <span class="metric">Renewal: <strong>${sandboxVendor.renewalDate}</strong></span>
      <span class="metric">Renewal monthly price: <strong>$1,100</strong></span>
    </section>
    <a id="download-latest-invoice" data-testid="download-latest-invoice" href="/billing/invoices/latest.pdf" download="acme-latest-invoice.pdf">Download latest invoice</a>
    <form method="post" action="/billing/downgrade" data-testid="downgrade-form">
      <input type="hidden" name="fromPlan" value="${sandboxVendor.currentPlan}" />
      <label>Target plan
        <select id="target-plan" name="targetPlan">
          <option value="${sandboxVendor.targetPlan}">${sandboxVendor.targetPlan}</option>
        </select>
      </label>
      <button id="submit-downgrade" type="submit">Downgrade plan</button>
    </form>
    <form method="post" action="/billing/cancel" data-testid="cancel-form">
      <button id="cancel-subscription" type="submit" class="danger">Cancel subscription</button>
    </form>
    <script id="renewal-json" type="application/json">${JSON.stringify(renewalData())}</script>`
  );
}

export function adminUsersPage(): string {
  const rows = sandboxUsers
    .map(
      (user) => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role)}</td></tr>`
    )
    .join('');

  return pageShell(
    'Acme Analytics Admin Users',
    `<h1>Admin users</h1>
    <table data-testid="admin-users-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <form method="post" action="/admin/users/invite" data-testid="invite-admin-form">
      <label>Email <input id="invite-email" name="email" type="email" /></label>
      <input type="hidden" name="role" value="admin" />
      <button id="invite-admin" type="submit" class="danger">Invite admin</button>
    </form>`
  );
}

export function renewalData() {
  return {
    vendorName: sandboxVendor.vendorName,
    currentPlan: sandboxVendor.currentPlan,
    currentMonthlyPriceCents: sandboxVendor.currentMonthlyPriceCents,
    renewalMonthlyPriceCents: sandboxVendor.renewalMonthlyPriceCents,
    renewalDate: sandboxVendor.renewalDate,
    seatCount: sandboxVendor.seatCount,
    unusedSeats: sandboxVendor.unusedSeats,
    estimatedMonthlySavingsCents: sandboxVendor.estimatedMonthlySavingsCents,
    recommendation: 'downgrade_to_starter'
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
