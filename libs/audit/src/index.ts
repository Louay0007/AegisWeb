export type AuditStatus = {
  ready: true;
  hashChain: 'phase-0-placeholder';
};

export function getAuditStatus(): AuditStatus {
  return {
    ready: true,
    hashChain: 'phase-0-placeholder'
  };
}
