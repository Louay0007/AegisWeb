-- DropForeignKey
ALTER TABLE "agents" DROP CONSTRAINT "agents_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "credential_agent_grants" DROP CONSTRAINT "credential_agent_grants_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "credentials" DROP CONSTRAINT "credentials_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "policies" DROP CONSTRAINT "policies_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "workflows" DROP CONSTRAINT "workflows_created_by_user_id_fkey";

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_agent_grants" ADD CONSTRAINT "credential_agent_grants_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
