ALTER TABLE "organizations"
ADD COLUMN "billing_email" TEXT;

ALTER TABLE "users"
ADD COLUMN "email_verified_at" TIMESTAMP(3),
ADD COLUMN "email_verification_token" TEXT,
ADD COLUMN "email_verification_sent_at" TIMESTAMP(3),
ADD COLUMN "password_reset_token" TEXT,
ADD COLUMN "password_reset_expires_at" TIMESTAMP(3);

CREATE INDEX "users_email_verification_token_idx" ON "users"("email_verification_token");
CREATE INDEX "users_password_reset_token_idx" ON "users"("password_reset_token");

CREATE TABLE "user_notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "approval_requests" BOOLEAN NOT NULL DEFAULT true,
    "run_completions" BOOLEAN NOT NULL DEFAULT false,
    "failures" BOOLEAN NOT NULL DEFAULT true,
    "slack_webhook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_notification_preferences_user_id_key" ON "user_notification_preferences"("user_id");

ALTER TABLE "user_notification_preferences"
ADD CONSTRAINT "user_notification_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
