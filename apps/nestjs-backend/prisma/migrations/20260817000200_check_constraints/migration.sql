-- Rules Prisma cannot put in schema.prisma. The app also checks these;
-- the database rejects a bad row even if a service is bypassed.

-- A share points at the room, or a folder, or a file — never folder and file together.
--
-- folder_id NULL, file_id NULL → whole Data Room
-- folder_id set,  file_id NULL → folder and its descendants
-- folder_id NULL, file_id set  → one file

ALTER TABLE "access_grants"
ADD CONSTRAINT "access_grants_single_target_check"
CHECK ("folder_id" IS NULL OR "file_id" IS NULL);

ALTER TABLE "access_invitations"
ADD CONSTRAINT "access_invitations_single_target_check"
CHECK ("folder_id" IS NULL OR "file_id" IS NULL);

ALTER TABLE "public_share_links"
ADD CONSTRAINT "public_share_links_single_target_check"
CHECK ("folder_id" IS NULL OR "file_id" IS NULL);

-- A folder cannot be its own parent (cycle of length 1).

ALTER TABLE "folders"
ADD CONSTRAINT "folders_no_self_parent_check"
CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

-- Sizes and keys that must be real object metadata.

ALTER TABLE "files"
ADD CONSTRAINT "files_size_non_negative_check"
CHECK ("size_bytes" >= 0);

ALTER TABLE "file_versions"
ADD CONSTRAINT "file_versions_storage_key_not_empty_check"
CHECK (char_length("storage_key") > 0);

ALTER TABLE "file_versions"
ADD CONSTRAINT "file_versions_number_positive_check"
CHECK ("version_number" >= 1);

ALTER TABLE "file_versions"
ADD CONSTRAINT "file_versions_size_non_negative_check"
CHECK ("size_bytes" >= 0);

-- current_version_id must belong to this file, not another file's version.

ALTER TABLE "files"
ADD CONSTRAINT "files_current_version_same_file_fk"
FOREIGN KEY ("current_version_id", "id")
REFERENCES "file_versions" ("id", "file_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
