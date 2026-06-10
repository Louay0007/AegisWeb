import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/policy-page";
import { legalPolicies } from "@/components/legal/policy-content";

export const metadata: Metadata = {
  title: "Security Policy | AegisWeb",
  description: legalPolicies.security.description,
};

export default function SecurityPolicyPage() {
  return <PolicyPage policy={legalPolicies.security} />;
}
