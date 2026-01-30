import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const playerFilter = searchParams.getAll("player");
    const characterFilter = searchParams.getAll("character");
    const only1v1 = searchParams.get("only1v1") === "true";

    console.log("API filters received:", {
      playerFilter,
      characterFilter,
      only1v1,
    });

    // Build Prisma where conditions - all filtering at database level
    const whereConditions: Prisma.matchesWhereInput[] = [
      { archived: false }, // Always exclude archived matches
    ];

    // Handle 1v1 filter: exactly 2 non-CPU participants
    // Prisma doesn't support HAVING COUNT in where clauses, so we use raw SQL
    // This is still efficient - we only get match IDs, not full match data
    if (only1v1) {
      const playerIds = playerFilter.length > 0 
        ? playerFilter.map((id) => BigInt(id))
        : [];

      if (playerIds.length > 0) {
        // 1v1 + player filter: Use raw SQL to combine both conditions efficiently
        // Build EXISTS conditions for each player (AND logic)
        const existsConditions = playerIds
          .map((_, idx) => {
            const alias = `mp${idx}`;
            return `EXISTS (
              SELECT 1 FROM match_participants ${alias}
              WHERE ${alias}.match_id = m.id 
              AND ${alias}.player = $${idx + 1}::bigint
              AND ${alias}.is_cpu = false
            )`;
          })
          .join(" AND ");

        const query = `
          SELECT m.id
          FROM matches m
          WHERE m.archived = false
          AND ${existsConditions}
          AND (
            SELECT COUNT(*) FROM match_participants mp_count
            WHERE mp_count.match_id = m.id AND mp_count.is_cpu = false
          ) = 2
        `;

        const oneVOneMatchIds = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
          query,
          ...playerIds
        );
        
        if (oneVOneMatchIds.length === 0) {
          return NextResponse.json({
            matches: [],
            pagination: { page, limit, hasMore: false },
          });
        }
        
        whereConditions.push({ id: { in: oneVOneMatchIds.map((m) => m.id) } });
      } else {
        // Simple 1v1 filter without player filter
        const oneVOneQuery = `
          SELECT m.id
          FROM matches m
          WHERE m.archived = false
          AND (
            SELECT COUNT(*) FROM match_participants mp_count
            WHERE mp_count.match_id = m.id AND mp_count.is_cpu = false
          ) = 2
        `;
        
        const oneVOneMatchIds = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(oneVOneQuery);
        
        if (oneVOneMatchIds.length === 0) {
          return NextResponse.json({
            matches: [],
            pagination: { page, limit, hasMore: false },
          });
        }
        
        whereConditions.push({ id: { in: oneVOneMatchIds.map((m) => m.id) } });
      }
    }

    // Player filter: ALL specified players must be in the match (AND logic)
    // Only apply if not already handled by 1v1 filter above
    if (playerFilter.length > 0 && !only1v1) {
      const playerIds = playerFilter.map((id) => BigInt(id));
      // For each player, ensure they have a participant record in the match
      const playerConditions = playerIds.map((playerId) => ({
        match_participants: {
          some: {
            player: playerId,
            is_cpu: false,
          },
        },
      }));
      whereConditions.push(...playerConditions);
    }

    // Character filter: ALL specified characters must be used in the match (AND logic)
    if (characterFilter.length > 0) {
      const characterConditions = characterFilter.map((character) => ({
        match_participants: {
          some: {
            smash_character: character,
          },
        },
      }));
      whereConditions.push(...characterConditions);
    }

    // Get matches with pagination - all filtering done at database level
    const matches = await prisma.matches.findMany({
      where: {
        AND: whereConditions,
      },
      include: {
        match_participants: {
          include: {
            players: {
              select: {
                name: true,
                display_name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
      skip: offset,
      take: limit,
    });

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        matches: [],
        pagination: {
          page,
          limit,
          hasMore: false,
        },
      });
    }

    // Transform the data to match the frontend interface
    const transformedMatches = matches.map((match) => ({
      id: Number(match.id),
      created_at: match.created_at.toISOString(),
      participants: match.match_participants.map((participant) => ({
        id: Number(participant.id),
        player: Number(participant.player),
        player_name: participant.players.name,
        player_display_name: participant.players.display_name,
        smash_character: participant.smash_character,
        is_cpu: participant.is_cpu,
        total_kos: participant.total_kos,
        total_falls: participant.total_falls,
        total_sds: participant.total_sds,
        has_won: participant.has_won,
      })),
    }));

    console.log(
      `Returning ${transformedMatches.length} matches for page ${page}`
    );

    // Return matches with pagination info
    return NextResponse.json({
      matches: transformedMatches,
      pagination: {
        page,
        limit,
        hasMore: transformedMatches.length === limit,
      },
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
