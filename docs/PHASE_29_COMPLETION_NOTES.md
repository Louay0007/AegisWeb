# Phase 29 Completion Notes: API Documentation And Contracts

Implemented: 2026-06-06

## Summary

Phase 29 adds OpenAPI documentation for the local AgentPass backend.

The API now exposes Swagger UI at `/docs` and generated OpenAPI JSON at `/docs-json`. The document includes backend route coverage, local auth schemes, worker-token auth, standard response envelopes, pagination components, and the standard error envelope used by the runtime exception filter.

## Added Files

```text
apps/api/src/docs/openapi.ts
tests/phase29-api-docs.spec.ts
docs/PHASE_29_COMPLETION_NOTES.md
```

## Updated Files

```text
apps/api/src/main.ts
apps/api/src/authorization/jwt-auth.guard.ts
package.json
pnpm-lock.yaml
```

## Dependencies

Added local OpenAPI tooling:

```text
@nestjs/swagger
swagger-ui-express
```

## OpenAPI Endpoints

Implemented:

```http
GET /docs
GET /docs-json
```

The documentation routes are public in local development so Angular client generation can fetch the contract without an access token.

## Documented Contract Pieces

The generated document includes:

- API title, description, version, and local server URL.
- Bearer JWT auth scheme for user-facing protected endpoints.
- `x-worker-token` API key scheme for internal worker endpoints.
- Standard `data` response envelope component.
- Standard paginated response envelope with `meta.total`, `meta.limit`, and `meta.offset`.
- Reusable `limit` and `offset` query parameters.
- Standard error response component:

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Authentication required.",
    "requestId": "req_123",
    "details": {}
  }
}
```

## Security Metadata

OpenAPI operation security is applied by route class:

- Public routes such as `/health`, `/auth/login`, `/auth/register`, `/auth/refresh`, and `/auth/logout` have no security requirement.
- Internal worker routes under `/internal/*` require `workerToken`.
- All other business endpoints require `bearerAuth`.

## Tests

Added:

```text
tests/phase29-api-docs.spec.ts
```

Coverage:

- Swagger UI is served at `/docs`.
- OpenAPI JSON is served at `/docs-json`.
- Main backend controller surfaces appear in the document.
- Auth, public, and worker route security metadata is present.
- Standard response, pagination, and error components are documented.
- Runtime unauthenticated errors still match the documented envelope.

## Acceptance

Phase 29 acceptance is satisfied:

- OpenAPI document builds.
- Swagger UI and JSON endpoints are available.
- Protected routes include auth metadata.
- Error response format is documented and tested.
- Pagination format is documented.
- Angular client generation can start from `/docs-json`.
