-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountState" AS ENUM ('ACTIVE', 'PENDING_DELETION', 'AGE_INELIGIBLE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('COUPLE', 'GROUP');

-- CreateEnum
CREATE TYPE "ConnectionState" AS ENUM ('PENDING', 'ACTIVE', 'DISCONNECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipState" AS ENUM ('INVITED', 'ACTIVE', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "LocationMode" AS ENUM ('LIVE', 'APPROXIMATE', 'GHOST', 'PAUSED');

-- CreateEnum
CREATE TYPE "LocationRetention" AS ENUM ('DISABLED', 'ONE_DAY', 'SEVEN_DAYS', 'THIRTY_DAYS');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('COUPLE', 'GROUP');

-- CreateEnum
CREATE TYPE "MessageState" AS ENUM ('ACCEPTED', 'DELETED');

-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('QUEUED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationState" AS ENUM ('QUARANTINED', 'APPROVED', 'REJECTED', 'REVIEW_REQUIRED', 'REMOVED', 'APPEALED');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('APPROVE', 'REMOVE', 'RETAIN', 'ESCALATE', 'RESTORE');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('ADULT_CONTENT', 'VIOLENCE', 'HATE', 'IMPERSONATION', 'HARASSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS', 'PRIVACY');

-- CreateEnum
CREATE TYPE "ConsentRequirement" AS ENUM ('REQUIRED', 'NOTIFICATION_ONLY');

-- CreateEnum
CREATE TYPE "ExportState" AS ENUM ('QUEUED', 'BUILDING', 'READY', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "NotificationFeature" AS ENUM ('CHAT', 'LOVE_PING');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'REVIEWER', 'SYSTEM_JOB');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email_normalized" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "account_state" "AccountState" NOT NULL DEFAULT 'ACTIVE',
    "date_of_birth" DATE NOT NULL,
    "birth_date_correction_count" SMALLINT NOT NULL DEFAULT 0,
    "age_eligible" BOOLEAN NOT NULL,
    "email_verified_at" TIMESTAMPTZ(6),
    "pending_email_normalized" VARCHAR(320),
    "pending_email_token_hash" TEXT,
    "pending_email_expires_at" TIMESTAMPTZ(6),
    "deletion_requested_at" TIMESTAMPTZ(6),
    "deletion_execute_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "avatar_asset_id" UUID,
    "mood_visible_to_blocked" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_public_id" VARCHAR(128) NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "device_name" VARCHAR(128),
    "app_version" VARCHAR(32),
    "os_version" VARCHAR(32),
    "last_seen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "token_family_id" UUID NOT NULL,
    "previous_session_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL,
    "document_type" "LegalDocumentType" NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "language" VARCHAR(8) NOT NULL,
    "content_uri" TEXT NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "consent_requirement" "ConsentRequirement" NOT NULL,
    "supersedes_document_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_legal_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "terms_version" VARCHAR(32) NOT NULL,
    "privacy_version" VARCHAR(32) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_hash" VARCHAR(128),
    "user_agent_hash" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_legal_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL,
    "type" "ConnectionType" NOT NULL,
    "state" "ConnectionState" NOT NULL,
    "name" VARCHAR(80),
    "created_by_user_id" UUID NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "disconnected_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_members" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "state" "MembershipState" NOT NULL,
    "invited_by_user_id" UUID,
    "invited_at" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6),
    "left_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "connection_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL,
    "blocker_user_id" UUID NOT NULL,
    "blocked_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_viewer_grants" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "viewer_user_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "location_viewer_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "instance_id" VARCHAR(128) NOT NULL,
    "connected_at" TIMESTAMPTZ(6) NOT NULL,
    "heartbeat_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "presence_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_settings" (
    "user_id" UUID NOT NULL,
    "mode" "LocationMode" NOT NULL DEFAULT 'PAUSED',
    "retention" "LocationRetention" NOT NULL DEFAULT 'SEVEN_DAYS',
    "approximate_seed_ciphertext" BYTEA,
    "approximate_window_started_at" TIMESTAMPTZ(6),
    "background_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "location_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy_meters" DECIMAL(8,2) NOT NULL,
    "source_is_background" BOOLEAN NOT NULL,
    "mode_at_capture" "LocationMode" NOT NULL,
    "sequence" BIGINT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "type" "ConversationType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_deleted_label" VARCHAR(64),
    "client_message_id" UUID NOT NULL,
    "body_text" TEXT NOT NULL,
    "state" "MessageState" NOT NULL DEFAULT 'ACCEPTED',
    "server_sequence" BIGINT NOT NULL,
    "reply_to_message_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "edited_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reaction" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_conversation_cursors" (
    "device_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "last_received_sequence" BIGINT NOT NULL DEFAULT 0,
    "last_read_sequence" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "device_conversation_cursors_pkey" PRIMARY KEY ("device_id","conversation_id")
);

-- CreateTable
CREATE TABLE "moods" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mood_code" VARCHAR(32) NOT NULL,
    "note" VARCHAR(140),
    "expires_at" TIMESTAMPTZ(6),
    "cleared_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "love_pings" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "target_user_id" UUID,
    "target_all" BOOLEAN NOT NULL,
    "client_request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "love_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "love_ping_deliveries" (
    "love_ping_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "state" "DeliveryState" NOT NULL,
    "delivered_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(64),

    CONSTRAINT "love_ping_deliveries_pkey" PRIMARY KEY ("love_ping_id","recipient_user_id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "token_ciphertext" BYTEA NOT NULL,
    "token_fingerprint" VARCHAR(128) NOT NULL,
    "last_validated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "feature" "NotificationFeature" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","feature")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "device_id" UUID,
    "feature" "NotificationFeature" NOT NULL,
    "resource_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "state" "DeliveryState" NOT NULL,
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "purpose" VARCHAR(32) NOT NULL,
    "storage_provider" VARCHAR(16) NOT NULL,
    "bucket" VARCHAR(128) NOT NULL,
    "object_key" TEXT NOT NULL,
    "content_type" VARCHAR(64) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "moderation_state" "ModerationState",
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatar_moderation_cases" (
    "id" UUID NOT NULL,
    "media_asset_id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "provider_result_json" JSONB NOT NULL,
    "policy_version" VARCHAR(32) NOT NULL,
    "state" "ModerationState" NOT NULL,
    "review_due_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "evidence_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "avatar_moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatar_reports" (
    "id" UUID NOT NULL,
    "avatar_asset_id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "context" VARCHAR(250),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "avatar_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_reviews" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "decision" "ModerationDecision" NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "policy_version" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_appeals" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "context" VARCHAR(500),
    "decision" "ModerationDecision",
    "reviewer_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_exports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "state" "ExportState" NOT NULL,
    "asset_id" UUID,
    "requested_at" TIMESTAMPTZ(6) NOT NULL,
    "ready_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "downloaded_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(64),
    "schema_version" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(96) NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_id" UUID,
    "connection_id" UUID,
    "result" VARCHAR(32) NOT NULL,
    "reason_code" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "correlation_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE INDEX "users_account_state_deletion_execute_at_idx" ON "users"("account_state", "deletion_execute_at");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE INDEX "devices_user_id_revoked_at_idx" ON "devices"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_device_public_id_key" ON "devices"("user_id", "device_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_expires_at_idx" ON "sessions"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "sessions_token_family_id_revoked_at_idx" ON "sessions"("token_family_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_device_id_revoked_at_idx" ON "sessions"("device_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_document_type_version_language_key" ON "legal_documents"("document_type", "version", "language");

-- CreateIndex
CREATE UNIQUE INDEX "user_legal_consents_user_id_terms_version_privacy_version_key" ON "user_legal_consents"("user_id", "terms_version", "privacy_version");

-- CreateIndex
CREATE INDEX "connections_type_state_idx" ON "connections"("type", "state");

-- CreateIndex
CREATE INDEX "connections_created_by_user_id_state_idx" ON "connections"("created_by_user_id", "state");

-- CreateIndex
CREATE INDEX "connection_members_user_id_state_idx" ON "connection_members"("user_id", "state");

-- CreateIndex
CREATE INDEX "connection_members_connection_id_state_role_idx" ON "connection_members"("connection_id", "state", "role");

-- CreateIndex
CREATE UNIQUE INDEX "connection_members_connection_id_user_id_key" ON "connection_members"("connection_id", "user_id");

-- CreateIndex
CREATE INDEX "user_blocks_blocked_user_id_blocker_user_id_idx" ON "user_blocks"("blocked_user_id", "blocker_user_id");

-- CreateIndex
CREATE INDEX "presence_sessions_user_id_expires_at_idx" ON "presence_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "presence_sessions_session_id_idx" ON "presence_sessions"("session_id");

-- CreateIndex
CREATE INDEX "locations_connection_id_user_id_captured_at_idx" ON "locations"("connection_id", "user_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "locations_expires_at_idx" ON "locations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "locations_device_id_sequence_key" ON "locations"("device_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_connection_id_key" ON "conversations"("connection_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_server_sequence_idx" ON "messages"("conversation_id", "server_sequence" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_server_sequence_key" ON "messages"("conversation_id", "server_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_message_id_user_id_reaction_key" ON "message_reactions"("message_id", "user_id", "reaction");

-- CreateIndex
CREATE INDEX "moods_user_id_cleared_at_expires_at_idx" ON "moods"("user_id", "cleared_at", "expires_at");

-- CreateIndex
CREATE INDEX "love_pings_connection_id_created_at_idx" ON "love_pings"("connection_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "love_pings_sender_user_id_client_request_id_key" ON "love_pings"("sender_user_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_fingerprint_key" ON "push_tokens"("token_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "notification_jobs_idempotency_key_key" ON "notification_jobs"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");

-- CreateIndex
CREATE INDEX "media_assets_owner_user_id_purpose_deleted_at_idx" ON "media_assets"("owner_user_id", "purpose", "deleted_at");

-- CreateIndex
CREATE INDEX "avatar_moderation_cases_state_review_due_at_idx" ON "avatar_moderation_cases"("state", "review_due_at");

-- CreateIndex
CREATE INDEX "avatar_moderation_cases_evidence_expires_at_legal_hold_idx" ON "avatar_moderation_cases"("evidence_expires_at", "legal_hold");

-- CreateIndex
CREATE INDEX "avatar_reports_avatar_asset_id_created_at_idx" ON "avatar_reports"("avatar_asset_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "moderation_appeals_case_id_user_id_key" ON "moderation_appeals"("case_id", "user_id");

-- CreateIndex
CREATE INDEX "data_exports_user_id_created_at_idx" ON "data_exports"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "data_exports_state_expires_at_idx" ON "data_exports"("state", "expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_connection_id_created_at_idx" ON "audit_logs"("connection_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_user_id_operation_idempotency_key_key" ON "idempotency_records"("user_id", "operation", "idempotency_key");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_previous_session_id_fkey" FOREIGN KEY ("previous_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_supersedes_document_id_fkey" FOREIGN KEY ("supersedes_document_id") REFERENCES "legal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_legal_consents" ADD CONSTRAINT "user_legal_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_members" ADD CONSTRAINT "connection_members_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_members" ADD CONSTRAINT "connection_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_members" ADD CONSTRAINT "connection_members_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_viewer_grants" ADD CONSTRAINT "location_viewer_grants_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_viewer_grants" ADD CONSTRAINT "location_viewer_grants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_viewer_grants" ADD CONSTRAINT "location_viewer_grants_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_sessions" ADD CONSTRAINT "presence_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_sessions" ADD CONSTRAINT "presence_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_settings" ADD CONSTRAINT "location_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_conversation_cursors" ADD CONSTRAINT "device_conversation_cursors_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_conversation_cursors" ADD CONSTRAINT "device_conversation_cursors_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moods" ADD CONSTRAINT "moods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "love_pings" ADD CONSTRAINT "love_pings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "love_pings" ADD CONSTRAINT "love_pings_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "love_pings" ADD CONSTRAINT "love_pings_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "love_ping_deliveries" ADD CONSTRAINT "love_ping_deliveries_love_ping_id_fkey" FOREIGN KEY ("love_ping_id") REFERENCES "love_pings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "love_ping_deliveries" ADD CONSTRAINT "love_ping_deliveries_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_moderation_cases" ADD CONSTRAINT "avatar_moderation_cases_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_reports" ADD CONSTRAINT "avatar_reports_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_reports" ADD CONSTRAINT "avatar_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "avatar_moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_reviews" ADD CONSTRAINT "moderation_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "avatar_moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_correction_count_check" CHECK ("birth_date_correction_count" BETWEEN 0 AND 1);
ALTER TABLE "users" ADD CONSTRAINT "users_pending_email_triplet_check" CHECK (
  ("pending_email_normalized" IS NULL AND "pending_email_token_hash" IS NULL AND "pending_email_expires_at" IS NULL)
  OR ("pending_email_normalized" IS NOT NULL AND "pending_email_token_hash" IS NOT NULL AND "pending_email_expires_at" IS NOT NULL)
);
CREATE UNIQUE INDEX "users_pending_email_normalized_unique" ON "users" ("pending_email_normalized") WHERE "pending_email_normalized" IS NOT NULL;

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_username_format_check" CHECK ("username" ~ '^[a-z0-9_]{3,20}$');
ALTER TABLE "devices" ADD CONSTRAINT "devices_platform_android_check" CHECK ("platform" = 'ANDROID');
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_language_check" CHECK ("language" IN ('vi', 'en'));

ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_not_self_check" CHECK ("blocker_user_id" <> "blocked_user_id");
CREATE UNIQUE INDEX "user_blocks_active_unique" ON "user_blocks" ("blocker_user_id", "blocked_user_id") WHERE "revoked_at" IS NULL;

ALTER TABLE "location_viewer_grants" ADD CONSTRAINT "location_grants_not_self_check" CHECK ("owner_user_id" <> "viewer_user_id");
CREATE UNIQUE INDEX "location_grants_active_unique" ON "location_viewer_grants" ("connection_id", "owner_user_id", "viewer_user_id") WHERE "revoked_at" IS NULL;

ALTER TABLE "locations" ADD CONSTRAINT "locations_lat_check" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "locations" ADD CONSTRAINT "locations_lng_check" CHECK ("longitude" BETWEEN -180 AND 180);
ALTER TABLE "locations" ADD CONSTRAINT "locations_accuracy_check" CHECK ("accuracy_meters" > 0);

CREATE UNIQUE INDEX "messages_client_id_unique" ON "messages" ("conversation_id", "sender_user_id", "client_message_id") WHERE "sender_user_id" IS NOT NULL;

ALTER TABLE "love_pings" ADD CONSTRAINT "love_pings_target_mode_check" CHECK (
  ("target_all" = true AND "target_user_id" IS NULL)
  OR ("target_all" = false AND "target_user_id" IS NOT NULL)
);

ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_purpose_check" CHECK ("purpose" IN ('AVATAR', 'EXPORT'));

CREATE OR REPLACE FUNCTION enforce_group_membership_invariants() RETURNS trigger AS $$
DECLARE
  conn_type "ConnectionType";
  active_count integer;
  owner_count integer;
BEGIN
  SELECT "type" INTO conn_type FROM "connections" WHERE "id" = NEW."connection_id";
  IF conn_type = 'GROUP' AND NEW."state" IN ('INVITED', 'ACTIVE') THEN
    SELECT COUNT(*) INTO active_count FROM "connection_members"
      WHERE "connection_id" = NEW."connection_id"
        AND "state" IN ('INVITED', 'ACTIVE')
        AND ("id" IS DISTINCT FROM NEW."id");
    IF active_count + 1 > 10 THEN
      RAISE EXCEPTION 'GROUP_CAPACITY_EXCEEDED';
    END IF;
    IF NEW."role" = 'OWNER' AND NEW."state" = 'ACTIVE' THEN
      SELECT COUNT(*) INTO owner_count FROM "connection_members"
        WHERE "connection_id" = NEW."connection_id"
          AND "role" = 'OWNER'
          AND "state" = 'ACTIVE'
          AND ("id" IS DISTINCT FROM NEW."id");
      IF owner_count >= 1 THEN
        RAISE EXCEPTION 'GROUP_OWNER_UNIQUE';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connection_members_group_invariants
  BEFORE INSERT OR UPDATE ON "connection_members"
  FOR EACH ROW EXECUTE FUNCTION enforce_group_membership_invariants();


