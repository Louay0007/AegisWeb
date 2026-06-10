export type PolicyIconName = "cookie" | "file" | "lock" | "scale" | "shield";

export type PolicySection = {
  id: string;
  title: string;
  body: string[];
  bullets?: string[];
};

export type PolicyPageContent = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  effectiveAt: string;
  icon: PolicyIconName;
  summary: string[];
  sections: PolicySection[];
};

export const legalPolicies = {
  cookies: {
    slug: "cookies",
    eyebrow: "Cookie policy",
    title: "Cookies that support secure agent operations.",
    description:
      "This policy explains how AegisWeb uses cookies and similar technologies for authentication, security, preferences, and product analytics.",
    updatedAt: "June 9, 2026",
    effectiveAt: "June 9, 2026",
    icon: "cookie",
    summary: [
      "Essential cookies keep sign-in, sessions, and security controls working.",
      "Analytics cookies help us understand product reliability and usage patterns.",
      "AegisWeb does not use advertising cookies or sell cookie-derived data.",
    ],
    sections: [
      {
        id: "what-are-cookies",
        title: "What cookies are",
        body: [
          "Cookies are small text files stored by your browser. Similar technologies, such as local storage and pixels, can help remember preferences, secure sessions, or measure product usage.",
          "Because AegisWeb protects agent authority, some cookies are required to keep account access, session integrity, and abuse prevention reliable.",
        ],
      },
      {
        id: "how-we-use",
        title: "How we use cookies",
        body: [
          "We use cookies and local storage only for product purposes that support the AegisWeb service.",
        ],
        bullets: [
          "Authenticate users and maintain secure dashboard sessions.",
          "Remember whether you accepted the cookie notice.",
          "Protect against suspicious access, replay, and session abuse.",
          "Measure aggregate product performance and feature usage.",
        ],
      },
      {
        id: "categories",
        title: "Cookie categories",
        body: [
          "Our cookies fall into a small set of practical categories. We keep these categories narrow so the product remains understandable and controllable.",
        ],
        bullets: [
          "Essential: required for authentication, session continuity, and security.",
          "Preferences: remember interface choices and consent state.",
          "Analytics: help us understand reliability, page performance, and product adoption.",
        ],
      },
      {
        id: "choices",
        title: "Your choices",
        body: [
          "You can block or delete cookies in your browser settings. Some essential cookies are required for secure use of the dashboard and may affect login or account features if disabled.",
          "If you previously accepted cookies, you can clear your browser storage for this site to reset the notice.",
        ],
      },
      {
        id: "no-ads",
        title: "No advertising tracking",
        body: [
          "AegisWeb is infrastructure for agent trust. We do not use cookies to build advertising profiles, retarget visitors, or sell personal information.",
        ],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    eyebrow: "Privacy policy",
    title: "Privacy for teams delegating authority to agents.",
    description:
      "This policy describes the information AegisWeb processes to provide identity, permission, approval, credential, workflow, and audit features.",
    updatedAt: "June 9, 2026",
    effectiveAt: "June 9, 2026",
    icon: "lock",
    summary: [
      "We process account, organization, workflow, approval, and audit data to operate the service.",
      "Credentials and sensitive evidence receive additional controls and redaction where practical.",
      "We do not sell personal information or use customer workflow data for advertising.",
    ],
    sections: [
      {
        id: "information-we-collect",
        title: "Information we collect",
        body: [
          "AegisWeb collects information needed to create accounts, operate organizations, run workflows, enforce policies, and produce audit receipts.",
        ],
        bullets: [
          "Account details such as name, email address, role, and organization.",
          "Agent, vendor, policy, workflow, approval, receipt, and audit records.",
          "Security logs such as request identifiers, authentication events, and access metadata.",
          "Evidence uploaded during workflows, such as screenshots, downloads, and generated receipts.",
        ],
      },
      {
        id: "how-we-use",
        title: "How we use information",
        body: [
          "We use information to provide and secure the product, enforce permissions, route approval requests, troubleshoot reliability, and improve the customer experience.",
        ],
        bullets: [
          "Authenticate users and scope access to their organization.",
          "Evaluate agent actions against policies and approval rules.",
          "Create durable receipts and audit histories.",
          "Detect abuse, investigate incidents, and maintain service integrity.",
        ],
      },
      {
        id: "credentials",
        title: "Credentials and secrets",
        body: [
          "Credentials are sensitive by design. AegisWeb is built to reduce raw secret exposure by storing credential material securely and injecting it only into controlled sessions when authorized.",
          "Operators should avoid placing unnecessary personal data in credentials, policy notes, workflow names, or approval comments.",
        ],
      },
      {
        id: "sharing",
        title: "How information is shared",
        body: [
          "We share information only as needed to provide the service, comply with law, prevent abuse, or support customer-requested integrations.",
        ],
        bullets: [
          "Service providers that host, secure, monitor, or support the platform.",
          "Customer-configured integrations such as approval, webhook, or notification destinations.",
          "Legal or safety recipients when required by law or to protect rights and security.",
        ],
      },
      {
        id: "retention",
        title: "Retention",
        body: [
          "Audit and receipt records may be retained for longer periods because they provide operational evidence. Customers should configure retention expectations based on their compliance needs.",
        ],
      },
      {
        id: "rights",
        title: "Your choices and rights",
        body: [
          "Depending on your location, you may have rights to access, correct, export, or delete personal information. Organization administrators may also manage user access, roles, and workflow data inside AegisWeb.",
        ],
      },
    ],
  },
  terms: {
    slug: "terms",
    eyebrow: "Terms of service",
    title: "Terms for controlled agent authority.",
    description:
      "These terms define responsible use of AegisWeb as an identity, permission, approval, credential, and audit layer for web agents.",
    updatedAt: "June 9, 2026",
    effectiveAt: "June 9, 2026",
    icon: "scale",
    summary: [
      "You are responsible for the agents, workflows, vendors, and credentials you configure.",
      "AegisWeb provides controls and evidence, but customers decide which actions agents may request.",
      "The service must not be used for unlawful, deceptive, harmful, or unauthorized activity.",
    ],
    sections: [
      {
        id: "account-responsibility",
        title: "Account responsibility",
        body: [
          "You are responsible for maintaining accurate account information, protecting access to your organization, and ensuring users have appropriate roles.",
          "You are also responsible for the actions performed by agents, workers, integrations, or users operating under your organization.",
        ],
      },
      {
        id: "authorized-use",
        title: "Authorized use",
        body: [
          "You may use AegisWeb to manage controlled agent access to websites, vendors, credentials, approvals, and receipts when you have the right to do so.",
        ],
        bullets: [
          "Do not connect agents to accounts, vendors, or systems you are not authorized to access.",
          "Do not bypass website terms, security controls, or applicable laws.",
          "Do not misrepresent an agent as a human when disclosure is required.",
        ],
      },
      {
        id: "customer-data",
        title: "Customer data",
        body: [
          "Your organization retains responsibility for customer data submitted to AegisWeb. You grant AegisWeb the rights needed to host, process, secure, and display that data to provide the service.",
        ],
      },
      {
        id: "availability",
        title: "Availability and changes",
        body: [
          "We may update, suspend, or modify parts of the service to improve reliability, security, or compliance. We aim to avoid unnecessary disruption to critical workflows.",
        ],
      },
      {
        id: "disclaimers",
        title: "Disclaimers",
        body: [
          "AegisWeb provides control-plane infrastructure, not legal, financial, procurement, or compliance advice. Customers should review high-impact agent actions with appropriate human decision-makers.",
        ],
      },
    ],
  },
  security: {
    slug: "security",
    eyebrow: "Security policy",
    title: "Security controls for non-human web work.",
    description:
      "This policy explains the security model AegisWeb applies around identities, roles, credentials, workflow evidence, and audit events.",
    updatedAt: "June 9, 2026",
    effectiveAt: "June 9, 2026",
    icon: "shield",
    summary: [
      "Access is scoped by organization, role, and permission.",
      "Credentials are handled as sensitive material and should be granted narrowly.",
      "Audit events and receipts are core security records, not decorative logs.",
    ],
    sections: [
      {
        id: "access-control",
        title: "Access control",
        body: [
          "AegisWeb uses organization scoping, authenticated sessions, roles, and permissions to restrict access to product resources.",
        ],
        bullets: [
          "Owners and admins should periodically review users and roles.",
          "Approver and auditor roles should be used for separation of duties.",
          "Agent access should be limited to the smallest useful vendor and workflow scope.",
        ],
      },
      {
        id: "credential-security",
        title: "Credential security",
        body: [
          "Credential access should be treated as privileged. AegisWeb is designed to store credentials securely and expose them only to authorized controlled runtime paths.",
        ],
        bullets: [
          "Grant credentials only to agents and workflows that need them.",
          "Revoke credentials and grants when an agent is paused, revoked, or no longer needs access.",
          "Rotate vendor credentials according to your internal security policy.",
        ],
      },
      {
        id: "audit-evidence",
        title: "Audit evidence",
        body: [
          "Audit events, screenshots, downloaded files, approval decisions, and receipts form the evidence layer for agent actions.",
          "Because evidence may contain sensitive vendor or account data, customers should restrict receipt and file access to appropriate roles.",
        ],
      },
      {
        id: "incident-response",
        title: "Incident response",
        body: [
          "If you suspect unauthorized access or unintended agent activity, pause affected agents, revoke relevant credentials, preserve audit records, and contact your administrator or AegisWeb support path.",
        ],
      },
      {
        id: "responsible-disclosure",
        title: "Responsible disclosure",
        body: [
          "If you discover a security issue, report it with enough detail to reproduce and evaluate impact. Do not access, modify, or disclose data that does not belong to you.",
        ],
      },
    ],
  },
  acceptableUse: {
    slug: "acceptable-use",
    eyebrow: "Acceptable use policy",
    title: "Responsible boundaries for agentic web automation.",
    description:
      "This policy defines uses that are prohibited or require special care when operating AI agents through AegisWeb.",
    updatedAt: "June 9, 2026",
    effectiveAt: "June 9, 2026",
    icon: "file",
    summary: [
      "Use AegisWeb only for systems and websites you are authorized to access.",
      "Do not use agents for deception, abuse, credential theft, spam, or unauthorized scraping.",
      "High-risk workflows should be gated with human approval and appropriate oversight.",
    ],
    sections: [
      {
        id: "prohibited-uses",
        title: "Prohibited uses",
        body: [
          "AegisWeb must not be used to support unlawful, harmful, deceptive, or unauthorized activity.",
        ],
        bullets: [
          "Unauthorized access to accounts, websites, systems, or data.",
          "Credential theft, phishing, impersonation, or social engineering.",
          "Spam, fraud, abuse, harassment, or evasion of security controls.",
          "Unlawful scraping, data exfiltration, or surveillance.",
          "Actions that violate applicable laws, contracts, or platform rules.",
        ],
      },
      {
        id: "high-risk-uses",
        title: "High-risk uses",
        body: [
          "Some workflows require extra review, even when authorized. Customers should use approval rules, receipts, and audit review for sensitive operations.",
        ],
        bullets: [
          "Purchases, cancellations, downgrades, renewals, and billing changes.",
          "Administrative user invites or permission changes.",
          "Access to payroll, finance, HR, legal, health, or regulated information.",
          "Actions that submit forms, accept terms, or change security settings.",
        ],
      },
      {
        id: "operator-duties",
        title: "Operator duties",
        body: [
          "Operators should configure agents with least privilege, maintain clear ownership, review approvals promptly, and investigate unexpected workflow outcomes.",
        ],
      },
      {
        id: "enforcement",
        title: "Enforcement",
        body: [
          "We may restrict or suspend access when usage creates security, legal, platform, or abuse risk. We aim to be proportionate and practical when responding to policy concerns.",
        ],
      },
    ],
  },
} satisfies Record<string, PolicyPageContent>;

export type LegalPolicyKey = keyof typeof legalPolicies;
