# Phase 9 Completion Notes: AgentsModule

Date: 2026-06-06

## Scope Implemented

Phase 9 added AI agent identity management.

Implemented endpoints:

- `GET /agents`
- `POST /agents`
- `GET /agents/:id`
- `PATCH /agents/:id`
- `POST /agents/:id/pause`
- `POST /agents/:id/resume`
- `POST /agents/:id/revoke`
- `GET /agents/:id/activity`

## AgentsModule

Files:

- `apps/api/src/agents/agents.module.ts`
- `apps/api/src/agents/agents.controller.ts`
- `apps/api/src/agents/agents.service.ts`
- `apps/api/src/agents/agent-identifier.service.ts`
- `apps/api/src/agents/agent-status.service.ts`
- `apps/api/src/agents/agent-activity.service.ts`
- `apps/api/src/agents/agents.types.ts`
- `apps/api/src/agents/index.ts`

Implemented:

- Organization-scoped agent list.
- Organization-scoped agent detail.
- Agent create.
- Agent update.
- Pause.
- Resume.
- Revoke.
- Activity feed.
- Workflow-start guard helper.

## Permissions

Routes require:

- `agent:read` for list, detail, and activity.
- `agent:create` for create.
- `agent:update` for update.
- `agent:pause` for pause and resume.
- `agent:revoke` for revoke.

Approvers can read agents but cannot create them.

## AgentIdentifierService

File:

- `apps/api/src/agents/agent-identifier.service.ts`

Implemented:

- Slug-based identifier generation.
- Identifier format validation.
- Duplicate avoidance with numeric suffixes.

Identifier format:

```text
procurement-bot@agentpass.local
procurement-bot-2@agentpass.local
```

## AgentStatusService

File:

- `apps/api/src/agents/agent-status.service.ts`

Implemented status rules:

- Revoked agents cannot be paused.
- Only paused agents can be resumed.
- Revoked agents cannot be resumed.
- Already revoked agents cannot be revoked again.
- Only active agents can start workflow runs.

Workflow-start helper:

```ts
await agentsService.assertAgentCanStartWorkflow(organizationId, agentId);
```

This throws `AGENT_NOT_ACTIVE` for paused or revoked agents.

## AgentActivityService

File:

- `apps/api/src/agents/agent-activity.service.ts`

Activity includes:

- Agent summary.
- Latest 25 audit events for the agent.
- Latest 10 workflow runs for the agent.

## Audit Events

Implemented:

- `agent_created`
- `agent_updated`
- `agent_paused`
- `agent_resumed`
- `agent_revoked`

All agent audit events include `agent_id`.

## Business Rules

Implemented:

- Agent identifiers are globally unique.
- Agent identifiers must use `agentpass.local`.
- Cross-organization agent reads return not found.
- Cross-organization agent mutations return not found.
- Revoked agents cannot be updated.
- Revoked agents cannot be resumed.
- Paused and revoked agents cannot start workflow runs.

## Application Wiring

File updated:

- `apps/api/src/app.module.ts`

Changed:

- `AgentsModule` is imported into the main API module.

## Tests Added

File:

- `tests/phase9-agents.spec.ts`

Coverage:

- Identifier generation.
- Identifier validation.
- Create/list/get/update.
- Create and update audit events.
- Approver cannot create agent.
- Approver can read agent.
- Pause and resume.
- Paused agent blocks workflow start.
- Revoked agent blocks workflow start.
- Revoked agent cannot be resumed.
- Revoked agent cannot be updated.
- Revoked agent cannot be revoked again.
- Activity includes audit events.
- Activity includes recent workflow runs.
- Cross-organization access is denied.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 10 test files passed.
- 71 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
