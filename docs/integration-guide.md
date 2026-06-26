# AegisWeb Integration Guide

This guide explains how design partners connect AegisWeb to vendor workflows during the pilot.

## Supported Workflow Templates

Current templates:

- `vendor_invoice_download`
- `saas_renewal_check`
- `plan_downgrade_request`

Each template runs through the same control layers: agent identity, policy evaluation, credential injection, audit logging, and receipts.

## Vendor Requirements

For each vendor, collect:

- Portal URL
- Login method
- Credential owner
- Known MFA or SSO requirements
- Allowed actions
- Approval thresholds
- Expected evidence output

## Credential Integration

Store credentials only in the AegisWeb vault.

Recommended pilot controls:

- Dedicated service or test account where possible.
- Minimum permissions needed for the workflow.
- One credential per vendor account.
- Grant credentials to named agents only.

## Policy Integration

Create policies before running production-like tasks.

Common rules:

- Allow read-only invoice download.
- Require approval for plan changes.
- Deny billing detail changes.
- Pause agent on unusual risk signals.
- Restrict allowed domains.

## Webhook and API Roadmap

API keys and outbound webhooks are placeholders in the product today. During pilot, use the UI and scheduled workflows. Partner-specific integration requests should be logged through the feedback widget.

## Validation Checklist

- Vendor login succeeds without exposing plaintext secrets.
- Screenshots mask sensitive fields.
- Audit trail records each material step.
- Receipt is generated for every terminal run state.
- Approval gates trigger for risky actions.

## Support

For integration issues, include the workflow ID, run ID, vendor name, timestamp, and expected result when contacting support@aegisweb.com.
