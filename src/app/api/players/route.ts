import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get all players with their stats in a single optimized query
    const playersWithData = await prisma.players.findMany({
      orderBy: {
        elo: 'desc',
      },
      include: {
        match_participants: {
          where: {
            is_cpu: false,
          },
          include: {
            match: {
              include: {
                match_participants: {
                  where: { is_cpu: false },
                },
              },
            },
          },
          orderBy: {
            match_id: 'desc',
          },
        },
      },
    });

    // Get top 10 RANKED players by ELO for ranking calculations
    const top10PlayerIds = playersWithData
      .filter(player => player.is_ranked)
      .slice(0, 10)
      .map(player => player.id);

    // Transform the data to include calculated stats (remove async operations to speed up)
    const transformedPlayers = playersWithData.map((player) => {
      // Get main character
      let mainCharacter: string | null = null;
      if (player.match_participants.length > 0) {
        const characterCounts: Record<string, number> = {};
        player.match_participants.forEach(p => {
          characterCounts[p.smash_character] = (characterCounts[p.smash_character] || 0) + 1;
        });
        const mostCommon = Object.entries(characterCounts)
          .sort(([,a], [,b]) => b - a)[0];
        mainCharacter = mostCommon ? mostCommon[0] : null;
      }

      // Get stats (only from 1v1 matches)
      const oneVOneParticipants = player.match_participants.filter(p => 
        p.match && p.match.match_participants.length === 2
      );

      const stats = {
        total_wins: oneVOneParticipants.filter(p => p.has_won).length,
        total_losses: oneVOneParticipants.filter(p => !p.has_won).length,
        total_kos: oneVOneParticipants.reduce((sum, p) => sum + p.total_kos, 0),
        total_falls: oneVOneParticipants.reduce((sum, p) => sum + p.total_falls, 0),
        total_sds: oneVOneParticipants.reduce((sum, p) => sum + p.total_sds, 0),
        current_win_streak: (() => {
          let streak = 0;
          for (const participant of oneVOneParticipants) {
            if (participant.has_won) {
              streak++;
            } else {
              break;
            }
          }
          return streak;
        })(),
      };

      // Calculate how many unique top 10 players this player has played against (excluding themselves)
      const uniqueTop10Opponents = new Set<bigint>();
      for (const participant of player.match_participants) {
        if (participant.match && participant.match.match_participants.length === 2) {
          // Find the opponent in this match
          const opponent = participant.match.match_participants.find(
            mp => mp.player !== player.id && !mp.is_cpu
          );
          if (opponent && 
              top10PlayerIds.some(id => id === opponent.player) && 
              opponent.player !== player.id) {
            uniqueTop10Opponents.add(opponent.player);
          }
        }
      }

      const top10PlayersPlayed = uniqueTop10Opponents.size;
      const isRanked = top10PlayersPlayed >= 3;

      // Note: We'll update the database separately to avoid connection issues
      // For now, just return the calculated values

      return {
        id: Number(player.id),
        created_at: player.created_at.toISOString(),
        name: player.name,
        display_name: player.display_name,
        elo: Number(player.elo),
        is_ranked: isRanked,
        top_10_players_played: top10PlayersPlayed,
        main_character: mainCharacter,
        total_wins: stats.total_wins,
        total_losses: stats.total_losses,
        total_kos: stats.total_kos,
        total_falls: stats.total_falls,
        total_sds: stats.total_sds,
        current_win_streak: stats.current_win_streak,
      };
    });

    return NextResponse.json(transformedPlayers);
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}