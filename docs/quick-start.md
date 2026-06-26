# AegisWeb Quick Start

Use this guide to complete the first controlled agent run in a new workspace.

## 1. Create Your Workspace

1. Open AegisWeb and select **Create workspace**.
2. Enter your organization name, domain, work email, and password.
3. Verify your email from the link sent to your inbox.
4. Open **Getting Started** from the sidebar.

## 2. Create Your First Agent

Create an agent with a clear purpose, for example `Invoice collector`.

Recommended purpose: `Download monthly SaaS invoices and produce receipts.`

## 3. Add a Vendor

Add the SaaS portal the agent will access.

Required fields:

- Vendor name
- Vendor URL
- Category
- Renewal date and monthly cost, if known

## 4. Store a Credential

Open **Credentials** and create a vault entry for the vendor.

Use the minimum credential needed for the workflow. Do not use personal admin credentials for pilots unless explicitly approved by your security owner.

## 5. Create a Workflow

Open **Workflows** and create a workflow from one of the supported templates:

- Vendor invoice download
- SaaS renewal check
- Plan downgrade request

Attach the agent, vendor, credential, and policy bundle.

## 6. Start a Run

Start the workflow and monitor:

- **Runs** for live state
- **Approvals** for human decisions
- **Audit** for immutable events
- **Receipts** for completed evidence

## Success Criteria

Your quick start is complete when:

- The first run completes, waits for approval, or fails with a clear error.
- A receipt or audit trail exists for the attempted run.
- No plaintext credential appears in receipts, logs, audit events, or screenshots.

## Support

- Email: support@aegisweb.com
- Status: https://status.aegisweb.com
- Feedback: use the in-app feedback widget.
