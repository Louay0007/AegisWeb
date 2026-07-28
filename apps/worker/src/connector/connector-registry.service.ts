import { Inject, Injectable } from '@nestjs/common';
import {
  ConnectorType,
  DomainError,
  DomainErrorCode,
  assertConnectorSupportsTemplate,
  connectorSupports,
  ConnectorCapability
} from '@agentpass/domain';
import { GitHubConnector } from './github.connector.js';
import { SandboxVendorConnector } from './sandbox-vendor.connector.js';
import { StripeBillingConnector } from './stripe-billing.connector.js';
import { VendorConnector } from './vendor-connector.types.js';

@Injectable()
export class ConnectorRegistry {
  constructor(
    @Inject(SandboxVendorConnector) private readonly sandbox: SandboxVendorConnector,
    @Inject(StripeBillingConnector) private readonly stripeBilling: StripeBillingConnector,
    @Inject(GitHubConnector) private readonly github: GitHubConnector
  ) {}

  resolve(connectorType: ConnectorType | string | null | undefined): VendorConnector {
    const normalized = normalizeConnectorType(connectorType);
    switch (normalized) {
      case ConnectorType.StripeBilling:
        return this.stripeBilling;
      case ConnectorType.Github:
        return this.github;
      case ConnectorType.Sandbox:
      default:
        return this.sandbox;
    }
  }

  assertSupports(connectorType: ConnectorType | string | null | undefined, template: string): VendorConnector {
    const normalized = normalizeConnectorType(connectorType);
    try {
      assertConnectorSupportsTemplate(normalized, template);
    } catch (error) {
      throw new DomainError(
        DomainErrorCode.UnsupportedConnectorCapability,
        error instanceof Error ? error.message : 'Connector does not support this workflow template.',
        { connectorType: normalized, template }
      );
    }
    return this.resolve(normalized);
  }

  supports(connectorType: ConnectorType | string | null | undefined, capability: ConnectorCapability): boolean {
    return connectorSupports(normalizeConnectorType(connectorType), capability);
  }
}

export function normalizeConnectorType(value: ConnectorType | string | null | undefined): ConnectorType {
  if (value === ConnectorType.StripeBilling || value === 'stripe_billing' || value === 'STRIPE_BILLING') {
    return ConnectorType.StripeBilling;
  }
  if (value === ConnectorType.Github || value === 'github' || value === 'GITHUB') {
    return ConnectorType.Github;
  }
  return ConnectorType.Sandbox;
}
