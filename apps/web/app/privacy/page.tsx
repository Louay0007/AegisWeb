import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/policy-page";
import { legalPolicies } from "@/components/legal/policy-content";

export const metadata: Metadata = {
  title: "Privacy Policy | AegisWeb",
  description: legalPolicies.privacy.description,
};

export default function PrivacyPolicyPage() {
  return <PolicyPage policy={legalPolicies.privacy} />;
}
