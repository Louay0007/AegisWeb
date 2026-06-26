"use client";

export type AegisUser = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

export type AegisSession = {
  expiresInSeconds?: number;
  user: AegisUser;
  mode: "api" | "demo";
};

export type DemoUser = {
  name: string;
  email: string;
  role: string;
  label: string;
  detail: string;
};

export const DEMO_PASSWORD = "Password123!";

export const DEMO_USERS: DemoUser[] = [
  {
    name: "Louay Founder",
    email: "founder@northstarlabs.dev",
    role: "OWNER",
    label: "Owner",
    detail: "Full authority, policies, users, and receipts.",
  },
  {
    name: "Finance Ops",
    email: "finance@northstarlabs.dev",
    role: "APPROVER",
    label: "Approver",
    detail: "Reviews risky renewals and plan changes.",
  },
  {
    name: "Audit Lead",
    email: "auditor@northstarlabs.dev",
    role: "AUDITOR",
    label: "Auditor",
    detail: "Reads evidence without changing authority.",
  },
  {
    name: "Dev Operator",
    email: "dev@northstarlabs.dev",
    role: "DEVELOPER",
    label: "Developer",
    detail: "Tests integrations and workflow behavior.",
  },
];
