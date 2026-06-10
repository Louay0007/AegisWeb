export type AuditLinkSource = {
  workflowRun?: string;
  payload?: Record<string, unknown>;
};

export type AuditRelatedLink = {
  label: string;
  href: string;
};

export function relatedAuditLinks(event: AuditLinkSource): AuditRelatedLink[] {
  const links = new Map<string, AuditRelatedLink>();

  if (event.workflowRun && event.workflowRun !== "workspace") {
    addLink(links, "Open run", `/app/runs/${event.workflowRun}`);
  }

  for (const { key, value } of flattenPayload(event.payload ?? {})) {
    const normalized = key.toLowerCase();
    if (normalized.includes("receipt") && looksLikeId(value)) {
      addLink(links, "Open receipt", `/app/receipts/${value}`);
    }
    if ((normalized.includes("approval") || normalized.includes("approvalrequest")) && looksLikeId(value)) {
      addLink(links, "Open approval", `/app/approvals/${value}`);
    }
    if ((normalized.includes("runid") || normalized === "run") && looksLikeId(value)) {
      addLink(links, "Open run", `/app/runs/${value}`);
    }
  }

  return [...links.values()];
}

function addLink(links: Map<string, AuditRelatedLink>, label: string, href: string) {
  links.set(href, { label, href });
}

function flattenPayload(payload: Record<string, unknown>, prefix = ""): Array<{ key: string; value: string }> {
  const pairs: Array<{ key: string; value: string }> = [];

  for (const [key, value] of Object.entries(payload)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      pairs.push({ key: path, value });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          pairs.push(...flattenPayload(item as Record<string, unknown>, `${path}.${index}`));
        }
      });
    } else if (value && typeof value === "object") {
      pairs.push(...flattenPayload(value as Record<string, unknown>, path));
    }
  }

  return pairs;
}

function looksLikeId(value: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,}$/.test(value);
}
