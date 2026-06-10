import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/policy-page";
import { legalPolicies } from "@/components/legal/policy-content";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | AegisWeb",
  description: legalPolicies.acceptableUse.description,
};

export default function AcceptableUsePolicyPage() {
  return <PolicyPage policy={legalPolicies.acceptableUse} />;
}
