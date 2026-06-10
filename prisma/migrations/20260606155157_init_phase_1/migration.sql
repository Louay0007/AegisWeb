-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('owner', 'admin', 'approver', 'auditor', 'developer');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'invited', 'disabled');

-- CreateEnum
CREATE TYPE "agent_status" AS ENUM ('active', 'paused', 'revoked');

-- CreateEnum
CREATE TYPE "vendor_category" AS ENUM ('analytics', 'productivity', 'sales', 'payroll', 'finance', 'security', 'other');

-- CreateEnum
CREATE TYPE "policy_type" AS ENUM ('website_allowlist', 'action_permissions', 'spending_limits', 'data_access', 'time_window', 'approval_rules', 'agent_policy_bundle');

-- CreateEnum
CREATE TYPE "policy_status" AS ENUM ('active', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "credential_type" AS ENUM ('username_password', 'totp_secret', 'api_token', 'oauth_token', 'session_cookie');

-- CreateEnum
CREATE TYPE "credential_status" AS ENUM ('active', 'revoked', 'rotated');

-- CreateEnum
CREATE TYPE "workflow_template" AS ENUM ('vendor_invoice_download', 'saas_renewal_check', 'plan_downgrade_request');

-- CreateEnum
CREATE TYPE "workflow_status" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "workflow_run_status" AS ENUM ('queued', 'running', 'waiting_for_approval', 'completed', 'failed', 'canceled', 'denied');

-- CreateEnum
CREATE TYPE "action_type" AS ENUM ('open_page', 'read_page', 'fill_form', 'click_button', 'download_file', 'submit_form', 'change_plan', 'cancel_subscription', 'invite_user', 'change_billing_details', 'make_purchase', 'credential_injection');

-- CreateEnum
CREATE TYPE "policy_decision" AS ENUM ('allow', 'deny', 'require_approval', 'require_step_up_auth', 'pause_agent');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'auto_approved', 'escalated');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('user', 'agent', 'worker', 'system', 'integration');

-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('organization_created', 'organization_updated', 'user_invited', 'user_registered', 'user_login_succeeded', 'user_login_failed', 'user_logout', 'token_refreshed', 'user_role_changed', 'user_disabled', 'agent_created', 'agent_updated', 'agent_paused', 'agent_resumed', 'agent_revoked', 'vendor_created', 'vendor_updated', 'vendor_deleted', 'policy_created', 'policy_updated', 'policy_evaluated', 'credential_created', 'credential_updated', 'credential_granted_to_agent', 'credential_grant_revoked', 'credential_revoked', 'credential_used', 'workflow_created', 'workflow_updated', 'workflow_run_requested', 'workflow_run_created', 'workflow_run_started', 'workflow_step_started', 'workflow_run_waiting_for_approval', 'workflow_run_completed', 'workflow_run_failed', 'workflow_run_canceled', 'workflow_run_denied', 'browser_page_opened', 'browser_element_clicked', 'file_downloaded', 'approval_requested', 'approval_approved', 'approval_rejected', 'approval_expired', 'receipt_created');

-- CreateEnum
CREATE TYPE "file_kind" AS ENUM ('screenshot', 'invoice', 'playwright_trace', 'receipt_export', 'download');

-- CreateEnum
CREATE TYPE "receipt_status" AS ENUM ('completed', 'failed', 'denied', 'canceled');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "agent_status" NOT NULL DEFAULT 'active',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "category" "vendor_category" NOT NULL,
    "renewal_date" DATE,
    "monthly_cost_cents" INTEGER,
    "owner_user_id" UUID,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID,
    "name" TEXT NOT NULL,
    "type" "policy_type" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "policy_status" NOT NULL DEFAULT 'active',
    "rules_json" JSONB NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "credential_type" "credential_type" NOT NULL,
    "encrypted_payload" JSONB NOT NULL,
    "encryption_version" TEXT NOT NULL,
    "status" "credential_status" NOT NULL DEFAULT 'active',
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_agent_grants" (
    "id" UUID NOT NULL,
    "credential_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "credential_agent_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "template" "workflow_template" NOT NULL,
    "status" "workflow_status" NOT NULL DEFAULT 'active',
    "configuration_json" JSONB NOT NULL DEFAULT '{}',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "vendor_id" UUID,
    "status" "workflow_run_status" NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "current_step" TEXT,
    "result_summary" TEXT,
    "error_message" TEXT,
    "state_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "vendor_id" UUID,
    "website" TEXT NOT NULL,
    "action_type" "action_type" NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "policy_decision" "policy_decision" NOT NULL,
    "policy_reason" TEXT,
    "input_summary" TEXT,
    "output_summary" TEXT,
    "amount_cents" INTEGER,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "action_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "action_attempt_id" UUID NOT NULL,
    "status" "approval_status" NOT NULL,
    "requested_by_agent_id" UUID NOT NULL,
    "approver_user_id" UUID,
    "summary" TEXT NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "amount_cents" INTEGER,
    "screenshot_file_id" UUID,
    "policy_triggered_json" JSONB NOT NULL DEFAULT '{}',
    "expires_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID,
    "agent_id" UUID,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_id" TEXT,
    "event_type" "audit_event_type" NOT NULL,
    "event_data_json" JSONB NOT NULL,
    "prev_hash" TEXT,
    "event_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID,
    "kind" "file_kind" NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_run_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "final_status" "receipt_status" NOT NULL,
    "summary" TEXT NOT NULL,
    "timeline_json" JSONB NOT NULL,
    "screenshots_json" JSONB NOT NULL DEFAULT '[]',
    "files_json" JSONB NOT NULL DEFAULT '[]',
    "policy_decisions_json" JSONB NOT NULL DEFAULT '[]',
    "approval_details_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_identifier_key" ON "agents"("identifier");

-- CreateIndex
CREATE INDEX "agents_organization_id_idx" ON "agents"("organization_id");

-- CreateIndex
CREATE INDEX "vendors_organization_id_idx" ON "vendors"("organization_id");

-- CreateIndex
CREATE INDEX "vendors_website_idx" ON "vendors"("website");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_organization_id_website_key" ON "vendors"("organization_id", "website");

-- CreateIndex
CREATE INDEX "policies_organization_id_idx" ON "policies"("organization_id");

-- CreateIndex
CREATE INDEX "policies_agent_id_idx" ON "policies"("agent_id");

-- CreateIndex
CREATE INDEX "credentials_organization_id_idx" ON "credentials"("organization_id");

-- CreateIndex
CREATE INDEX "credentials_vendor_id_idx" ON "credentials"("vendor_id");

-- CreateIndex
CREATE INDEX "credential_agent_grants_agent_id_idx" ON "credential_agent_grants"("agent_id");

-- CreateIndex
CREATE INDEX "credential_agent_grants_credential_id_idx" ON "credential_agent_grants"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "credential_agent_grants_credential_id_agent_id_key" ON "credential_agent_grants"("credential_id", "agent_id");

-- CreateIndex
CREATE INDEX "workflows_organization_id_idx" ON "workflows"("organization_id");

-- CreateIndex
CREATE INDEX "workflows_agent_id_idx" ON "workflows"("agent_id");

-- CreateIndex
CREATE INDEX "workflow_runs_organization_id_idx" ON "workflow_runs"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_id_idx" ON "workflow_runs"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "action_attempts_workflow_run_id_idx" ON "action_attempts"("workflow_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_action_attempt_id_key" ON "approval_requests"("action_attempt_id");

-- CreateIndex
CREATE INDEX "approval_requests_organization_id_idx" ON "approval_requests"("organization_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_idx" ON "audit_events"("organization_id");

-- CreateIndex
CREATE INDEX "audit_events_workflow_run_id_idx" ON "audit_events"("workflow_run_id");

-- CreateIndex
CREATE INDEX "files_organization_id_idx" ON "files"("organization_id");

-- CreateIndex
CREATE INDEX "files_workflow_run_id_idx" ON "files"("workflow_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_workflow_run_id_key" ON "receipts"("workflow_run_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_organization_id_idx" ON "refresh_tokens"("organization_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_agent_grants" ADD CONSTRAINT "credential_agent_grants_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_agent_grants" ADD CONSTRAINT "credential_agent_grants_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_agent_grants" ADD CONSTRAINT "credential_agent_grants_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_attempts" ADD CONSTRAINT "action_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_attempts" ADD CONSTRAINT "action_attempts_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_attempts" ADD CONSTRAINT "action_attempts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_attempts" ADD CONSTRAINT "action_attempts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_action_attempt_id_fkey" FOREIGN KEY ("action_attempt_id") REFERENCES "action_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_agent_id_fkey" FOREIGN KEY ("requested_by_agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_screenshot_file_id_fkey" FOREIGN KEY ("screenshot_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
