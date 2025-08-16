import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Type definitions
export interface Player {
  id: bigint;
  created_at: string;
  name: string;
  display_name: string | null;
  elo: bigint;
  top_ten_played: number;
  inactive: boolean;
  country?: string | null;
  main_character?: string | null;
  total_wins?: number;
  total_losses?: number;
  total_kos?: number;
  total_falls?: number;
  total_sds?: number;
  current_win_streak?: number;
}

export interface PlayerStats {
  total_wins: number;
  total_losses: number;
  total_kos: number;
  total_falls: number;
  total_sds: number;
  current_win_streak: number;
}

// Helper function to get most common character for a player
export async function getMostCommonCharacter(
  playerId: bigint
): Promise<string | null> {
  try {
    const participants = await prisma.match_participants.findMany({
      where: {
        player: playerId,
        match: {
          archived: false,
        },
      },
      select: {
        smash_character: true,
      },
    });

    if (participants.length === 0) {
      return null;
    }

    // Count character usage
    const characterCounts: Record<string, number> = {};
    participants.forEach((p) => {
      characterCounts[p.smash_character] =
        (characterCounts[p.smash_character] || 0) + 1;
    });

    // Find most common character
    const mostCommon = Object.entries(characterCounts).sort(
      ([, a], [, b]) => b - a
    )[0];

    return mostCommon ? mostCommon[0] : null;
  } catch (error) {
    console.error("Error getting main character:", error);
    return null;
  }
}

// Helper function to get player stats
export async function getPlayerStats(playerId: bigint): Promise<PlayerStats> {
  // Get all 1v1 matches for this player (matches with exactly 2 human participants, exclude archived)
  const oneVOneMatches = await prisma.matches.findMany({
    where: {
      archived: false,
      match_participants: {
        some: {
          player: playerId,
          is_cpu: false,
        },
      },
    },
    include: {
      match_participants: {
        where: {
          is_cpu: false,
        },
      },
    },
  });

  // Filter to only matches with exactly 2 human participants
  const validMatches = oneVOneMatches.filter(
    (match) => match.match_participants.length === 2
  );

  const validMatchIds = validMatches.map((match) => match.id);

  // Get all participant records for this player in 1v1 matches
  const playerParticipants = await prisma.match_participants.findMany({
    where: {
      player: playerId,
      is_cpu: false,
      match_id: {
        in: validMatchIds,
      },
    },
    orderBy: {
      match_id: "desc",
    },
  });

  // Calculate basic stats
  const totalWins = playerParticipants.filter((p) => p.has_won).length;
  const totalLosses = playerParticipants.filter((p) => !p.has_won).length;
  const totalKos = playerParticipants.reduce((sum, p) => sum + p.total_kos, 0);
  const totalFalls = playerParticipants.reduce(
    (sum, p) => sum + p.total_falls,
    0
  );
  const totalSds = playerParticipants.reduce((sum, p) => sum + p.total_sds, 0);

  // Calculate current win streak
  let currentWinStreak = 0;
  for (const participant of playerParticipants) {
    if (participant.has_won) {
      currentWinStreak++;
    } else {
      break;
    }
  }

  return {
    total_wins: totalWins,
    total_losses: totalLosses,
    total_kos: totalKos,
    total_falls: totalFalls,
    total_sds: totalSds,
    current_win_streak: currentWinStreak,
  };
}
