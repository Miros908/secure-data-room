-- Tables, indexes and foreign keys from prisma/schema.prisma.
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OauthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "AccessRole" AS ENUM ('VIEWER', 'EDITOR');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('FILE_VIEWED', 'FILE_DOWNLOADED', 'LINK_OPENED', 'ACCESS_GRANTED', 'ACCESS_REVOKED', 'FILE_DELETED', 'FOLDER_DELETED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255),
    "name" VARCHAR(120) NOT NULL,
    "email_verified_at" TIMESTAMPTZ,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "OauthProvider" NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_rooms" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "data_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "path" VARCHAR(2048) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "folder_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_versions" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "folder_id" UUID,
    "file_id" UUID,
    "role" "AccessRole" NOT NULL DEFAULT 'VIEWER',
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_invitations" (
    "id" UUID NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "data_room_id" UUID NOT NULL,
    "folder_id" UUID,
    "file_id" UUID,
    "role" "AccessRole" NOT NULL DEFAULT 'VIEWER',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "access_expires_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "access_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_share_links" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "folder_id" UUID,
    "file_id" UUID,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "public_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "type" "ActivityEventType" NOT NULL,
    "actor_user_id" UUID,
    "public_share_link_id" UUID,
    "file_id" UUID,
    "folder_id" UUID,
    "resource_name" VARCHAR(255),
    "request_id" VARCHAR(64) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_user_id_provider_key" ON "oauth_accounts"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_user_id_type_key" ON "auth_tokens"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "data_rooms_owner_id_key" ON "data_rooms"("owner_id");

-- CreateIndex
CREATE INDEX "folders_data_room_id_parent_id_name_id_idx" ON "folders"("data_room_id", "parent_id", "name", "id");

-- CreateIndex
CREATE INDEX "folders_data_room_id_path_idx" ON "folders"("data_room_id", "path");

-- CreateIndex
CREATE UNIQUE INDEX "folders_id_data_room_key" ON "folders"("id", "data_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_root_name_key" ON "folders"("data_room_id", "name") WHERE (parent_id IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "folders_parent_name_key" ON "folders"("parent_id", "name") WHERE (parent_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "files_current_version_id_key" ON "files"("current_version_id");

-- CreateIndex
CREATE INDEX "files_data_room_id_folder_id_name_id_idx" ON "files"("data_room_id", "folder_id", "name", "id");

-- CreateIndex
CREATE INDEX "files_uploaded_by_id_idx" ON "files"("uploaded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_id_data_room_key" ON "files"("id", "data_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_root_name_key" ON "files"("data_room_id", "name") WHERE (folder_id IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "files_folder_name_key" ON "files"("folder_id", "name") WHERE (folder_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "file_versions_storage_key_key" ON "file_versions"("storage_key");

-- CreateIndex
CREATE INDEX "file_versions_file_id_created_at_idx" ON "file_versions"("file_id", "created_at");

-- CreateIndex
CREATE INDEX "file_versions_uploaded_by_id_idx" ON "file_versions"("uploaded_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_versions_file_number_key" ON "file_versions"("file_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "file_versions_id_file_id_key" ON "file_versions"("id", "file_id");

-- CreateIndex
CREATE INDEX "access_grants_user_id_data_room_id_revoked_at_idx" ON "access_grants"("user_id", "data_room_id", "revoked_at");

-- CreateIndex
CREATE INDEX "access_grants_user_id_folder_id_revoked_at_idx" ON "access_grants"("user_id", "folder_id", "revoked_at");

-- CreateIndex
CREATE INDEX "access_grants_user_id_file_id_revoked_at_idx" ON "access_grants"("user_id", "file_id", "revoked_at");

-- CreateIndex
CREATE INDEX "access_grants_granted_by_id_idx" ON "access_grants"("granted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_grants_user_room_active_key" ON "access_grants"("user_id", "data_room_id") WHERE (folder_id IS NULL AND file_id IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "access_grants_user_folder_active_key" ON "access_grants"("user_id", "folder_id") WHERE (folder_id IS NOT NULL AND file_id IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "access_grants_user_file_active_key" ON "access_grants"("user_id", "file_id") WHERE (file_id IS NOT NULL AND folder_id IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "access_invitations_token_hash_key" ON "access_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "access_invitations_email_idx" ON "access_invitations"("email");

-- CreateIndex
CREATE INDEX "access_invitations_data_room_id_idx" ON "access_invitations"("data_room_id");

-- CreateIndex
CREATE INDEX "access_invitations_granted_by_id_idx" ON "access_invitations"("granted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_invitations_email_room_pending_key" ON "access_invitations"("email", "data_room_id") WHERE (folder_id IS NULL AND file_id IS NULL AND accepted_at IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "access_invitations_email_folder_pending_key" ON "access_invitations"("email", "folder_id") WHERE (folder_id IS NOT NULL AND file_id IS NULL AND accepted_at IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "access_invitations_email_file_pending_key" ON "access_invitations"("email", "file_id") WHERE (file_id IS NOT NULL AND folder_id IS NULL AND accepted_at IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "public_share_links_token_hash_key" ON "public_share_links"("token_hash");

-- CreateIndex
CREATE INDEX "public_share_links_data_room_id_revoked_at_idx" ON "public_share_links"("data_room_id", "revoked_at");

-- CreateIndex
CREATE INDEX "public_share_links_folder_id_revoked_at_idx" ON "public_share_links"("folder_id", "revoked_at");

-- CreateIndex
CREATE INDEX "public_share_links_file_id_revoked_at_idx" ON "public_share_links"("file_id", "revoked_at");

-- CreateIndex
CREATE INDEX "public_share_links_created_by_id_idx" ON "public_share_links"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_share_room_active_key" ON "public_share_links"("data_room_id") WHERE (folder_id IS NULL AND file_id IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "public_share_folder_active_key" ON "public_share_links"("folder_id") WHERE (folder_id IS NOT NULL AND file_id IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "public_share_file_active_key" ON "public_share_links"("file_id") WHERE (file_id IS NOT NULL AND folder_id IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE INDEX "activity_events_data_room_id_created_at_id_idx" ON "activity_events"("data_room_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "activity_events_data_room_id_actor_user_id_created_at_idx" ON "activity_events"("data_room_id", "actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_events_data_room_id_public_share_link_id_created_a_idx" ON "activity_events"("data_room_id", "public_share_link_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_events_data_room_id_file_id_type_idx" ON "activity_events"("data_room_id", "file_id", "type");

-- CreateIndex
CREATE INDEX "activity_events_data_room_id_type_created_at_idx" ON "activity_events"("data_room_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_rooms" ADD CONSTRAINT "data_rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_data_room_id_fkey" FOREIGN KEY ("parent_id", "data_room_id") REFERENCES "folders"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_data_room_id_fkey" FOREIGN KEY ("folder_id", "data_room_id") REFERENCES "folders"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "file_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_folder_id_data_room_id_fkey" FOREIGN KEY ("folder_id", "data_room_id") REFERENCES "folders"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_file_id_data_room_id_fkey" FOREIGN KEY ("file_id", "data_room_id") REFERENCES "files"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_folder_id_data_room_id_fkey" FOREIGN KEY ("folder_id", "data_room_id") REFERENCES "folders"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_file_id_data_room_id_fkey" FOREIGN KEY ("file_id", "data_room_id") REFERENCES "files"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_share_links" ADD CONSTRAINT "public_share_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_share_links" ADD CONSTRAINT "public_share_links_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_share_links" ADD CONSTRAINT "public_share_links_folder_id_data_room_id_fkey" FOREIGN KEY ("folder_id", "data_room_id") REFERENCES "folders"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_share_links" ADD CONSTRAINT "public_share_links_file_id_data_room_id_fkey" FOREIGN KEY ("file_id", "data_room_id") REFERENCES "files"("id", "data_room_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_public_share_link_id_fkey" FOREIGN KEY ("public_share_link_id") REFERENCES "public_share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;


