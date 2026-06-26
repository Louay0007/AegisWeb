# Incident Response Plan

## Severity Matrix

| Severity | Definition | Response Time |
|----------|------------|---------------|
| SEV1 | Active data breach, full outage, vault compromise | Immediate |
| SEV2 | Major production degradation, worker failure, auth outage | 15 minutes |
| SEV3 | Partial feature outage, elevated error rate | 1 hour |
| SEV4 | Low-impact bug or monitoring-only alert | Next business day |

## Triage Checklist

1. Assign incident commander and scribe.
2. Determine severity, start time, affected users/orgs, affected systems, and current blast radius.
3. Preserve evidence before destructive remediation.
4. Decide containment action: disable workers, stop deploys, maintenance mode, revoke tokens, or roll back images.
5. Create a timeline and update it every 15 minutes for SEV1/SEV2.

## Communication Template

Subject: AegisWeb incident update - [SEV] [short title]

Current status: Investigating / Mitigating / Monitoring / Resolved

Impact: [who/what is affected]

Actions taken: [containment and recovery steps]

Next update: [time]

Customer action required: [yes/no and details]

## Evidence Preservation

1. Export API, worker, database, Redis, object storage, and CI/CD logs covering 30 minutes before detection through recovery.
2. Snapshot affected databases and object buckets before rollback or restore.
3. Record deployed image SHAs, environment variable versions, migration versions, and GitHub workflow run IDs.
4. Keep all evidence in restricted incident storage with audit logging.

## Post-Mortem Template

Title:

Severity:

Dates/times:

Customer impact:

Root cause:

Detection source:

Timeline:

What went well:

What went poorly:

Action items:

Owners and due dates:
