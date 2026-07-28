-- AlterEnum
CREATE TYPE "connector_type" AS ENUM ('sandbox', 'stripe_billing', 'github');

-- AlterTable
ALTER TABLE "vendors"
ADD COLUMN "connector_type" "connector_type" NOT NULL DEFAULT 'sandbox';

-- CreateIndex
CREATE INDEX "vendors_connector_type_idx" ON "vendors"("connector_type");
