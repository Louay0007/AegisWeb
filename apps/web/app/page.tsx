import { CookieConsentBar } from "@/components/cookie-consent-bar";
import { Header } from "@/components/header";
import { HeroSection } from "@/components/sections/hero-section";
import { PhilosophySection } from "@/components/sections/philosophy-section";
import { PricingSection } from "@/components/sections/pricing-section";
import { ProofSection } from "@/components/sections/proof-section";
import { WorkflowSection } from "@/components/sections/workflow-section";
import { SecurityModelSection } from "@/components/sections/security-model-section";
import { DeveloperSection } from "@/components/sections/developer-section";
import { FaqSection } from "@/components/sections/faq-section";
import { FooterSection } from "@/components/sections/footer-section";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <PhilosophySection />
      <WorkflowSection />
      <SecurityModelSection />
      <PricingSection />
      <ProofSection />
      <DeveloperSection />
      <FaqSection />
      <FooterSection />
      <CookieConsentBar />
    </main>
  );
}
