-- Substring search on file/folder names (ILIKE '%q%') needs pg_trgm.
-- Listing still uses btree (data_room_id, parent/folder, name, id).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "files_name_trgm_idx" ON "files" USING gin ("name" gin_trgm_ops);
CREATE INDEX "folders_name_trgm_idx" ON "folders" USING gin ("name" gin_trgm_ops);
