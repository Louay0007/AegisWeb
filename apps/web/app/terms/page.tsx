import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/policy-page";
import { legalPolicies } from "@/components/legal/policy-content";

export const metadata: Metadata = {
  title: "Terms of Service | AegisWeb",
  description: legalPolicies.terms.description,
};

export default function TermsPage() {
  return <PolicyPage policy={legalPolicies.terms} />;
}
