import { ConnectorType as PrismaConnectorType } from '@prisma/client';
import { ConnectorType } from '@agentpass/domain';

export function toPrismaConnectorType(connectorType: ConnectorType): PrismaConnectorType {
  switch (connectorType) {
    case ConnectorType.Sandbox:
      return PrismaConnectorType.SANDBOX;
    case ConnectorType.StripeBilling:
      return PrismaConnectorType.STRIPE_BILLING;
    case ConnectorType.Github:
      return PrismaConnectorType.GITHUB;
  }
}

export function fromPrismaConnectorType(connectorType: PrismaConnectorType): ConnectorType {
  switch (connectorType) {
    case PrismaConnectorType.SANDBOX:
      return ConnectorType.Sandbox;
    case PrismaConnectorType.STRIPE_BILLING:
      return ConnectorType.StripeBilling;
    case PrismaConnectorType.GITHUB:
      return ConnectorType.Github;
  }
}
