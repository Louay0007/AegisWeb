import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/policy-page";
import { legalPolicies } from "@/components/legal/policy-content";

export const metadata: Metadata = {
  title: "Cookie Policy | AegisWeb",
  description: legalPolicies.cookies.description,
};

export default function CookiePolicyPage() {
  return <PolicyPage policy={legalPolicies.cookies} />;
}
