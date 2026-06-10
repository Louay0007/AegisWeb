# Phase 7 Completion Notes: FilesModule

Date: 2026-06-06

## Scope Implemented

Phase 7 added local artifact storage through MinIO with organization-scoped metadata in PostgreSQL.

Implemented endpoints:

- `GET /files/:id`
- `GET /files/:id/download`

Implemented internal APIs:

- `createFileRecord`
- `uploadBuffer`
- `uploadStream`
- `getSignedReadUrl`
- `calculateSha256`

## FilesModule

Files:

- `apps/api/src/files/files.module.ts`
- `apps/api/src/files/files.controller.ts`
- `apps/api/src/files/files.service.ts`
- `apps/api/src/files/file-storage.service.ts`
- `apps/api/src/files/files.types.ts`
- `apps/api/src/files/index.ts`

Implemented:

- Protected file metadata endpoint.
- Protected file download endpoint.
- `file:read` permission requirement on file routes.
- Organization-scoped file lookup.
- Download integrity verification with SHA-256.
- Controlled errors for missing records or missing storage objects.

## FileStorageService

File:

- `apps/api/src/files/file-storage.service.ts`

Implemented:

- S3-compatible MinIO client.
- Local bucket creation on first upload.
- Object upload.
- Object existence checks.
- Object download.
- Short-lived signed read URLs.

Dependency added:

- `@aws-sdk/s3-request-presigner`

## FilesService

File:

- `apps/api/src/files/files.service.ts`

Implemented:

- `uploadBuffer(...)`
- `uploadStream(...)`
- `createFileRecord(...)`
- `downloadForOrganization(...)`
- `getFileForOrganization(...)`
- `getSignedReadUrl(...)`
- `calculateSha256(...)`

Rules enforced:

- File kind must be known.
- File records cannot be created for missing storage objects.
- Workflow-run file uploads must belong to the same organization.
- Object keys include organization and workflow-run prefixes.
- Raw bytes are verified against stored SHA-256 on download.

Object key format:

```text
organizations/{organizationId}/workflow-runs/{workflowRunId}/{fileId}/{filename}
```

For unscoped files:

```text
organizations/{organizationId}/unscoped/{fileId}/{filename}
```

## File DTO

File metadata responses include:

- `id`
- `organizationId`
- `workflowRunId`
- `kind`
- `bucket`
- `objectKey`
- `mimeType`
- `sizeBytes`
- `sha256`
- `createdAt`
- `signedReadUrl` on `GET /files/:id`

## Application Wiring

File updated:

- `apps/api/src/app.module.ts`

Changed:

- `FilesModule` is imported into the main API module.

## Tests Added

File:

- `tests/phase7-files.spec.ts`

Coverage:

- Upload buffer stores object in MinIO.
- File record contains hash and size.
- Object key contains organization and workflow-run prefixes.
- Metadata endpoint returns file data and a short-lived signed URL.
- Download endpoint returns original bytes.
- Cross-organization file metadata reads are rejected.
- Cross-organization file downloads are rejected.
- Creating a record for a missing object fails.
- A stored file pointing to a missing object returns a controlled `NOT_FOUND` error.

## Verification

Passed:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm smoke
```

Current test suite:

- 8 test files passed.
- 58 tests passed.

Smoke dependencies:

- PostgreSQL: ok
- Redis: ok
- MinIO: ok
