import { supabase } from "@/lib/supabase";
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

    // First, get match IDs that match our filters if any filters are provided
    let matchIds: number[] = [];

    if (playerFilter.length > 0 || characterFilter.length > 0 || only1v1) {
      // For AND filtering, we need to find matches that contain ALL specified players AND ALL specified characters

      // Step 1: Find all matches
      const { data: allMatches, error: allMatchesError } = await supabase.from(
        "matches"
      ).select(`
          id,
          match_participants (
            match_id,
            smash_character,
            players (
              name
            )
          )
        `);

      if (allMatchesError) {
        console.error("Error fetching all matches:", allMatchesError);
        throw allMatchesError;
      }

      // Step 2: Filter matches using AND logic
      const filteredMatches = allMatches?.filter((match) => {
        const participants = match.match_participants;

        // Check if ALL specified players are in this match
        if (playerFilter.length > 0) {
          const playersInMatch = participants
            .map((p) => (p.players as unknown as { name: string })?.name)
            .filter((name): name is string => Boolean(name));
          const hasAllPlayers = playerFilter.every((playerName) =>
            playersInMatch.includes(playerName)
          );
          if (!hasAllPlayers) return false;
        }

        // Check if ALL specified characters are used in this match
        if (characterFilter.length > 0) {
          const charactersInMatch = participants.map(
            (p: { smash_character: string }) => p.smash_character
          );
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

      matchIds = filteredMatches?.map((match) => match.id) || [];
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
    }

    // Build the main query
    let query = supabase.from("matches").select(
      `
        id,
        created_at,
        match_participants (
          id,
          player,
          smash_character,
          is_cpu,
          total_kos,
          total_falls,
          total_sds,
          has_won,
          players (
            name,
            display_name
          )
        )
      `
    );

    // Filter by match IDs if we have filters
    if (matchIds.length > 0) {
      query = query.in("id", matchIds);
    }

    const { data: matches, error: matchesError } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (matchesError) {
      throw matchesError;
    }

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

    // Transform the data to match our frontend interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedMatches = matches.map((match: any) => ({
      id: match.id,
      created_at: match.created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      participants: match.match_participants.map((participant: any) => ({
        id: participant.id,
        player: participant.player,
        player_name: participant.players?.name || "",
        player_display_name: participant.players?.display_name || null,
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
