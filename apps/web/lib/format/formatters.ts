export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function truncateMiddle(value: string, max = 22) {
  if (value.length <= max) {
    return value;
  }

  const keep = Math.floor((max - 3) / 2);
  return `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

export function redactSecretPayload(payload: Record<string, unknown>) {
  const sensitive = /password|secret|token|credential|authorization|cookie|encrypted|payload/i;

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, sensitive.test(key) ? "[REDACTED]" : value]),
  );
}
