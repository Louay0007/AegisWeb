import { ConnectorType, WorkflowTemplate } from './enums.js';

export const ConnectorCapability = {
  Login: 'login',
  DownloadLatestInvoice: 'download_latest_invoice',
  ReadRenewalInfo: 'read_renewal_info',
  PrepareDowngrade: 'prepare_downgrade',
  SubmitDowngrade: 'submit_downgrade'
} as const;

export type ConnectorCapability =
  (typeof ConnectorCapability)[keyof typeof ConnectorCapability];

export type ConnectorCapabilityMatrix = Record<
  ConnectorType,
  ReadonlySet<ConnectorCapability>
>;

export const CONNECTOR_CAPABILITY_MATRIX: ConnectorCapabilityMatrix = {
  [ConnectorType.Sandbox]: new Set([
    ConnectorCapability.Login,
    ConnectorCapability.DownloadLatestInvoice,
    ConnectorCapability.ReadRenewalInfo,
    ConnectorCapability.PrepareDowngrade,
    ConnectorCapability.SubmitDowngrade
  ]),
  [ConnectorType.StripeBilling]: new Set([
    ConnectorCapability.Login,
    ConnectorCapability.DownloadLatestInvoice,
    ConnectorCapability.ReadRenewalInfo,
    ConnectorCapability.PrepareDowngrade,
    ConnectorCapability.SubmitDowngrade
  ]),
  [ConnectorType.Github]: new Set([
    ConnectorCapability.Login,
    ConnectorCapability.DownloadLatestInvoice,
    ConnectorCapability.ReadRenewalInfo,
    ConnectorCapability.PrepareDowngrade,
    ConnectorCapability.SubmitDowngrade
  ])
};

const TEMPLATE_REQUIRED_CAPABILITY: Record<string, ConnectorCapability> = {
  [WorkflowTemplate.VendorInvoiceDownload]: ConnectorCapability.DownloadLatestInvoice,
  [WorkflowTemplate.SaasRenewalCheck]: ConnectorCapability.ReadRenewalInfo,
  [WorkflowTemplate.PlanDowngradeRequest]: ConnectorCapability.PrepareDowngrade
};

export function connectorSupports(
  connectorType: ConnectorType,
  capability: ConnectorCapability
): boolean {
  return CONNECTOR_CAPABILITY_MATRIX[connectorType]?.has(capability) ?? false;
}

export function requiredCapabilityForTemplate(template: string): ConnectorCapability | null {
  return TEMPLATE_REQUIRED_CAPABILITY[template] ?? null;
}

export function assertConnectorSupportsTemplate(
  connectorType: ConnectorType,
  template: string
): void {
  const capability = requiredCapabilityForTemplate(template);
  if (!capability) {
    return;
  }
  if (!connectorSupports(connectorType, capability)) {
    throw new Error(
      `Connector ${connectorType} does not support capability ${capability} required by template ${template}.`
    );
  }
}
