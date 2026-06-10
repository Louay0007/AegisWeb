export const sandboxVendor = {
  vendorName: 'Acme Analytics',
  validUsername: 'finance@northstarlabs.dev',
  validPassword: 'acme-local-password',
  currentPlan: 'Growth',
  targetPlan: 'Starter',
  currentMonthlyPriceCents: 80000,
  renewalMonthlyPriceCents: 110000,
  starterMonthlyPriceCents: 32000,
  renewalDate: '2026-07-15',
  seatCount: 28,
  unusedSeats: 5,
  estimatedMonthlySavingsCents: 48000,
  invoiceId: 'INV-ACME-2026-0007'
} as const;

export const sandboxUsers = [
  { id: 'usr_owner', name: 'Maya Chen', email: 'founder@northstarlabs.dev', role: 'owner' },
  { id: 'usr_finance', name: 'Leo Martinez', email: 'finance@northstarlabs.dev', role: 'billing_admin' },
  { id: 'usr_viewer', name: 'Priya Shah', email: 'auditor@northstarlabs.dev', role: 'viewer' }
] as const;

export function latestInvoiceText(): string {
  return [
    'AgentPass Local Vendor Sandbox Invoice',
    `Invoice: ${sandboxVendor.invoiceId}`,
    `Vendor: ${sandboxVendor.vendorName}`,
    'Customer: Northstar Labs',
    `Plan: ${sandboxVendor.currentPlan}`,
    `Seats: ${sandboxVendor.seatCount}`,
    `Monthly total cents: ${sandboxVendor.currentMonthlyPriceCents}`,
    `Renewal date: ${sandboxVendor.renewalDate}`,
    `Renewal monthly cents: ${sandboxVendor.renewalMonthlyPriceCents}`
  ].join('\n');
}
