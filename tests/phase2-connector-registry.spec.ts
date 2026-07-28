import { describe, expect, it } from 'vitest';
import {
  ConnectorCapability,
  ConnectorType,
  CONNECTOR_CAPABILITY_MATRIX,
  connectorSupports,
  requiredCapabilityForTemplate
} from '../libs/domain/src/index.js';
import { normalizeConnectorType } from '../apps/worker/src/connector/connector-registry.service.js';

describe('connector capability matrix', () => {
  it('supports all workflow capabilities for sandbox, stripe, and github', () => {
    for (const connectorType of [
      ConnectorType.Sandbox,
      ConnectorType.StripeBilling,
      ConnectorType.Github
    ]) {
      expect(connectorSupports(connectorType, ConnectorCapability.Login)).toBe(true);
      expect(connectorSupports(connectorType, ConnectorCapability.DownloadLatestInvoice)).toBe(true);
      expect(connectorSupports(connectorType, ConnectorCapability.ReadRenewalInfo)).toBe(true);
      expect(connectorSupports(connectorType, ConnectorCapability.PrepareDowngrade)).toBe(true);
      expect(connectorSupports(connectorType, ConnectorCapability.SubmitDowngrade)).toBe(true);
      expect(CONNECTOR_CAPABILITY_MATRIX[connectorType].size).toBeGreaterThanOrEqual(5);
    }
  });

  it('maps templates to required capabilities', () => {
    expect(requiredCapabilityForTemplate('vendor_invoice_download')).toBe(
      ConnectorCapability.DownloadLatestInvoice
    );
    expect(requiredCapabilityForTemplate('saas_renewal_check')).toBe(ConnectorCapability.ReadRenewalInfo);
    expect(requiredCapabilityForTemplate('plan_downgrade_request')).toBe(
      ConnectorCapability.PrepareDowngrade
    );
  });

  it('normalizes prisma and domain connector type values', () => {
    expect(normalizeConnectorType('STRIPE_BILLING')).toBe(ConnectorType.StripeBilling);
    expect(normalizeConnectorType('github')).toBe(ConnectorType.Github);
    expect(normalizeConnectorType(null)).toBe(ConnectorType.Sandbox);
  });
});
