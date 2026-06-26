import Link from "next/link";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";

const guides = [
  { title: "Quick start", description: "Create your first agent, vendor, credential, workflow, and run.", href: "/app/getting-started" },
  { title: "User guide", description: "Understand approvals, receipts, audit trails, and daily workflow." },
  { title: "Admin guide", description: "Manage users, security, notifications, and pilot operations." },
  { title: "Integration guide", description: "Prepare vendors, credentials, policies, and workflow templates." },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pilot enablement" title="Help center" description="Everything design partners need to run governed vendor workflows and send feedback." />
      <section className="grid gap-4 md:grid-cols-2">
        {guides.map((guide) => (
          <article key={guide.title} className="border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-[-0.015em]">{guide.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{guide.description}</p>
            {guide.href ? <Button asChild className="mt-4"><Link href={guide.href}>Open</Link></Button> : <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">Available in repository docs</p>}
          </article>
        ))}
      </section>
      <section className="border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-[-0.015em]">Support channels</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <a className="border border-border p-3 hover:bg-muted/40" href="mailto:support@aegisweb.com">support@aegisweb.com</a>
          <a className="border border-border p-3 hover:bg-muted/40" href="https://status.aegisweb.com" target="_blank" rel="noreferrer">status.aegisweb.com</a>
          <a className="border border-border p-3 hover:bg-muted/40" href="mailto:support@aegisweb.com?subject=AegisWeb%20pilot%20feedback">Pilot feedback</a>
        </div>
      </section>
    </div>
  );
}
