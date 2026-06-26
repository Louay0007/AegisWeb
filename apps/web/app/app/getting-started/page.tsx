import { PageHeader } from "@/components/app-shell/page-header";
import { GettingStartedWizard } from "@/components/onboarding/getting-started-wizard";

export default function GettingStartedPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Onboarding" title="Getting started" description="Create the first agent, vendor, credential, workflow, and run without leaving the guide." />
      <GettingStartedWizard />
    </div>
  );
}
