import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // First get all matches with their participants
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select(
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
      )
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
          hasMore: false
        }
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

    // Return matches with pagination info
    return NextResponse.json({
      matches: transformedMatches,
      pagination: {
        page,
        limit,
        hasMore: transformedMatches.length === limit
      }
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
