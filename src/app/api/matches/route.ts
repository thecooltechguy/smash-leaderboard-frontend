import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

    // Build the base query conditions
    const whereConditions: { id?: { in: bigint[] } } = {};

    // Apply filters
    if (playerFilter.length > 0 || characterFilter.length > 0 || only1v1) {
      // First, get all matches with their participants
      const allMatches = await prisma.matches.findMany({
        include: {
          match_participants: {
            include: {
              players: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Filter matches using AND logic
      const filteredMatches = allMatches.filter((match) => {
        const participants = match.match_participants;

        // Check if ALL specified players are in this match
        if (playerFilter.length > 0) {
          const playersInMatch = participants
            .map((p) => p.players.name)
            .filter((name): name is string => Boolean(name));
          const hasAllPlayers = playerFilter.every((playerName) =>
            playersInMatch.includes(playerName)
          );
          if (!hasAllPlayers) return false;
        }

        // Check if ALL specified characters are used in this match
        if (characterFilter.length > 0) {
          const charactersInMatch = participants.map((p) => p.smash_character);
          const hasAllCharacters = characterFilter.every((character) =>
            charactersInMatch.includes(character)
          );
          if (!hasAllCharacters) return false;
        }

        // Check if it's a 1v1 match (exactly 2 players)
        if (only1v1) {
          if (participants.length !== 2) return false;
        }

        return true;
      });

      const matchIds = filteredMatches.map((match) => match.id);
      console.log("Found match IDs with filtering:", matchIds);

      if (matchIds.length === 0) {
        return NextResponse.json({
          matches: [],
          pagination: {
            page,
            limit,
            hasMore: false,
          },
        });
      }

      whereConditions.id = {
        in: matchIds,
      };
    }

    // Get matches with pagination
    const matches = await prisma.matches.findMany({
      where: whereConditions,
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
