import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { data: players, error } = await supabase
      .from("players")
      .select("*")
      .order("elo", { ascending: false });

    if (error) {
      throw error;
    }

    if (!players || players.length === 0) {
      return NextResponse.json([]);
    }

    // Get main character and stats for each player using RPC functions
    const playersWithData = await Promise.all(
      players.map(async (player) => {
        // Get main character
        const { data: mainCharacter, error: characterError } =
          await supabase.rpc("get_most_common_character", {
            player_id: player.id,
          });

        if (characterError) {
          console.error(
            `Error getting main character for player ${player.id}:`,
            characterError
          );
        }

        // Get player stats (wins/losses)
        const { data: stats, error: statsError } = await supabase.rpc(
          "get_player_stats",
          { player_id: player.id }
        );

        if (statsError) {
          console.error(
            `Error getting stats for player ${player.id}:`,
            statsError
          );
        }

        // Extract wins, losses, and combat stats from the stats result
        const playerStats =
          stats && stats.length > 0
            ? stats[0]
            : {
                total_wins: 0,
                total_losses: 0,
                total_kos: 0,
                total_falls: 0,
                total_sds: 0,
                current_win_streak: 0,
              };

        return {
          ...player,
          main_character: mainCharacter || null,
          total_wins: Number(playerStats.total_wins) || 0,
          total_losses: Number(playerStats.total_losses) || 0,
          total_kos: Number(playerStats.total_kos) || 0,
          total_falls: Number(playerStats.total_falls) || 0,
          total_sds: Number(playerStats.total_sds) || 0,
          current_win_streak: Number(playerStats.current_win_streak) || 0,
        };
      })
    );

    return NextResponse.json(playersWithData);
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}
