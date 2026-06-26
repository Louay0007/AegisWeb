"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/api-client";
import { authErrorMessage } from "@/lib/auth/auth-session";

const STEPS = ["Create agent", "Add vendor", "Store credential", "Create workflow", "Start run"];

export function GettingStartedWizard() {
  const [step, setStep] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [receipt, setReceipt] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      if (step === 0) {
        const created = await apiPost<{ id: string }>("/agents", { name: form.get("name"), purpose: form.get("purpose") });
        setAgentId(created.id);
      }
      if (step === 1) {
        const created = await apiPost<{ id: string }>("/vendors", { name: form.get("name"), website: form.get("website"), category: "productivity" });
        setVendorId(created.id);
      }
      if (step === 2) {
        const created = await apiPost<{ id: string }>("/credentials", { vendorId, label: form.get("label"), credentialType: "username_password", secretJson: { username: form.get("username"), password: form.get("password") } });
        setCredentialId(created.id);
      }
      if (step === 3) {
        const created = await apiPost<{ id: string }>("/workflows", { agentId, vendorId, name: form.get("name"), template: "vendor_invoice_download", configurationJson: { credentialId } });
        setWorkflowId(created.id);
      }
      if (step === 4) {
        const run = await apiPost<{ run: { id: string } }>(`/workflows/${workflowId}/runs`, {});
        setReceipt(run.run.id);
      }
      setStep((value) => Math.min(value + 1, STEPS.length));
      event.currentTarget.reset();
    } catch (apiError) {
      setError(authErrorMessage(apiError));
    }
  }

  if (step >= STEPS.length) {
    return (
      <section className="border border-border bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">First run started</h2>
        <p className="mt-2 text-sm text-muted-foreground">Run {receipt || workflowId} is now in the queue. Receipts appear when runs complete.</p>
        <div className="mt-5 flex gap-3"><Button asChild><Link href="/app/runs">View runs</Link></Button><Button asChild variant="outline"><Link href="/app/home">Dashboard</Link></Button></div>
      </section>
    );
  }

  return (
    <section className="border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h2 className="text-2xl font-semibold tracking-[-0.025em]">{STEPS[step]}</h2><p className="mt-1 text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</p></div>
        <Button variant="ghost" onClick={() => setStep((value) => Math.min(value + 1, STEPS.length))}>Skip</Button>
      </div>
      <div className="mt-5 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((label, index) => <div key={label} className={index <= step ? "h-1 bg-foreground" : "h-1 bg-muted"} />)}
      </div>
      {error ? <p className="mt-5 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      <form onSubmit={submit} className="mt-5 grid gap-4">
        {step === 0 ? <><FormField name="name" label="Agent name" placeholder="Invoice clerk" /><FormField name="purpose" label="Purpose" placeholder="Download invoices and generate receipts" /></> : null}
        {step === 1 ? <><FormField name="name" label="Vendor name" placeholder="Acme SaaS" /><FormField name="website" label="Vendor URL" placeholder="https://example.com" /></> : null}
        {step === 2 ? <><FormField name="label" label="Credential label" placeholder="Acme admin login" /><FormField name="username" label="Username" placeholder="ops@example.com" /><FormField name="password" label="Password" type="password" placeholder="Stored in vault" /></> : null}
        {step === 3 ? <FormField name="name" label="Workflow name" placeholder="Monthly invoice collection" /> : null}
        {step === 4 ? <p className="text-sm text-muted-foreground">Start the workflow and watch approvals, runs, audit events, and receipts populate.</p> : null}
        <Button type="submit" className="justify-self-start">{step === 4 ? "Start first run" : "Save and continue"}</Button>
      </form>
    </section>
  );
}

function FormField({ name, label, placeholder, type = "text" }: { name: string; label: string; placeholder: string; type?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} placeholder={placeholder} required /></div>;
}
