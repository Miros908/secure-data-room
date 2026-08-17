import { Injectable } from '@nestjs/common';
import { Prisma } from '../../database/generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { SearchHitRow } from './search.types';
import { containsIlikePattern, prefixIlikePattern } from './utils/like-pattern';
import type { SearchCursor } from './utils/search-cursor';
import type { SearchVisibility } from './utils/search-visibility';

const LIKE_ESCAPE = '\\';

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchHits(params: {
    dataRoomId: string;
    query: string;
    visibility: SearchVisibility;
    cursor: SearchCursor | null;
    take: number;
  }): Promise<SearchHitRow[]> {
    const pattern = containsIlikePattern(params.query);
    const fileVisible = fileVisibilitySql(params.visibility);
    const folderVisible = folderVisibilitySql(params.visibility);
    const cursorSql = params.cursor
      ? Prisma.sql`AND (hits.name, hits.kind, hits.id) > (${params.cursor.name}, ${params.cursor.kind}, ${params.cursor.id}::uuid)`
      : Prisma.empty;

    return this.prisma.$queryRaw<SearchHitRow[]>`
      SELECT
        hits.id,
        hits.name,
        hits.kind,
        hits.parent_id,
        hits.created_at,
        hits.mime_type,
        hits.size_bytes,
        hits.version_count,
        hits.folder_path
      FROM (
        SELECT
          f.id,
          f.name,
          'file'::text AS kind,
          f.folder_id AS parent_id,
          f.created_at,
          f.mime_type,
          f.size_bytes,
          (SELECT COUNT(*)::int FROM file_versions v WHERE v.file_id = f.id) AS version_count,
          fol.path AS folder_path
        FROM files f
        LEFT JOIN folders fol ON fol.id = f.folder_id
        WHERE f.data_room_id = ${params.dataRoomId}::uuid
          AND f.name ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE}
          AND (${fileVisible})
        UNION ALL
        SELECT
          d.id,
          d.name,
          'folder'::text AS kind,
          d.parent_id,
          d.created_at,
          NULL::varchar AS mime_type,
          NULL::bigint AS size_bytes,
          NULL::int AS version_count,
          d.path AS folder_path
        FROM folders d
        WHERE d.data_room_id = ${params.dataRoomId}::uuid
          AND d.name ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE}
          AND (${folderVisible})
      ) hits
      WHERE TRUE
      ${cursorSql}
      ORDER BY hits.name ASC, hits.kind ASC, hits.id ASC
      LIMIT ${params.take}
    `;
  }
}

function fileVisibilitySql(visibility: SearchVisibility): Prisma.Sql {
  if (visibility.type === 'room') {
    return Prisma.sql`TRUE`;
  }

  return sqlOr([
    inListSql(visibility.fileIds, (id) => Prisma.sql`f.id = ${id}::uuid`),
    visibility.folderPaths.length > 0
      ? Prisma.sql`EXISTS (
          SELECT 1
          FROM folders vis
          WHERE vis.id = f.folder_id
            AND vis.data_room_id = f.data_room_id
            AND (${pathPrefixSql('vis.path', visibility.folderPaths)})
        )`
      : Prisma.sql`FALSE`,
  ]);
}

function folderVisibilitySql(visibility: SearchVisibility): Prisma.Sql {
  if (visibility.type === 'room') {
    return Prisma.sql`TRUE`;
  }

  return pathPrefixSql('d.path', visibility.folderPaths);
}

function pathPrefixSql(
  column: 'vis.path' | 'd.path',
  paths: string[],
): Prisma.Sql {
  if (paths.length === 0) {
    return Prisma.sql`FALSE`;
  }

  const columnSql =
    column === 'vis.path' ? Prisma.sql`vis.path` : Prisma.sql`d.path`;

  return sqlOr(
    paths.map(
      (path) =>
        Prisma.sql`${columnSql} LIKE ${prefixIlikePattern(path)} ESCAPE ${LIKE_ESCAPE}`,
    ),
  );
}

function inListSql(
  ids: string[],
  clause: (id: string) => Prisma.Sql,
): Prisma.Sql {
  if (ids.length === 0) {
    return Prisma.sql`FALSE`;
  }

  return sqlOr(ids.map(clause));
}

function sqlOr(parts: Prisma.Sql[]): Prisma.Sql {
  const present = parts.filter((part) => part !== Prisma.empty);
  if (present.length === 0) {
    return Prisma.sql`FALSE`;
  }
  if (present.length === 1) {
    return present[0];
  }

  return Prisma.sql`(${Prisma.join(present, ' OR ')})`;
}
