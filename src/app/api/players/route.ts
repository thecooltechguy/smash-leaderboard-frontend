import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface PlayerQueryResult {
  id: bigint;
  created_at: Date;
  name: string;
  display_name: string | null;
  elo: bigint;
  country: string | null;
  picture: string | null;
  inactive: boolean;
  top_ten_played: number;
  main_character: string | null;
  total_wins: bigint;
  total_losses: bigint;
  total_kos: bigint;
  total_falls: bigint;
  total_sds: bigint;
  current_win_streak: bigint;
  is_ranked: boolean;
}

export async function GET() {
  try {
    // Simplified query using the top_ten_played column
    const query = `
    WITH 
    -- Get 1v1 matches only (exactly 2 non-CPU participants) and exclude archived matches
    one_v_one_matches AS (
      SELECT DISTINCT m.id as match_id
      FROM matches m
      JOIN match_participants mp ON m.id = mp.match_id
      WHERE mp.is_cpu = false AND m.archived = false
      GROUP BY m.id
      HAVING COUNT(*) = 2
    ),
    
    -- Main character calculation (mode of smash_character)
    main_chars AS (
      SELECT 
        mp.player,
        mp.smash_character,
        COUNT(*) as char_count,
        ROW_NUMBER() OVER (PARTITION BY mp.player ORDER BY COUNT(*) DESC, mp.smash_character) as rn
      FROM match_participants mp
      JOIN one_v_one_matches ovm ON mp.match_id = ovm.match_id
      WHERE mp.is_cpu = false
      GROUP BY mp.player, mp.smash_character
    ),
    
    -- Player stats from 1v1 matches only
    player_stats AS (
      SELECT 
        mp.player,
        COUNT(*) FILTER (WHERE mp.has_won = true) as total_wins,
        COUNT(*) FILTER (WHERE mp.has_won = false) as total_losses,
        COALESCE(SUM(mp.total_kos), 0) as total_kos,
        COALESCE(SUM(mp.total_falls), 0) as total_falls,
        COALESCE(SUM(mp.total_sds), 0) as total_sds
      FROM match_participants mp
      JOIN one_v_one_matches ovm ON mp.match_id = ovm.match_id
      WHERE mp.is_cpu = false
      GROUP BY mp.player
    ),
    
    -- Current win streak (consecutive wins from most recent matches)
    win_streaks AS (
      SELECT 
        ordered_matches.player,
        COUNT(*) as current_win_streak
      FROM (
        SELECT 
          mp.player,
          mp.match_id,
          mp.has_won,
          ROW_NUMBER() OVER (PARTITION BY mp.player ORDER BY mp.match_id DESC) as match_order
        FROM match_participants mp
        JOIN one_v_one_matches ovm ON mp.match_id = ovm.match_id
        WHERE mp.is_cpu = false
      ) ordered_matches
      WHERE ordered_matches.has_won = true 
        AND ordered_matches.match_order <= (
          SELECT COALESCE(MIN(sub.match_order), 999999)
          FROM (
            SELECT 
              ROW_NUMBER() OVER (PARTITION BY mp2.player ORDER BY mp2.match_id DESC) as match_order
            FROM match_participants mp2
            JOIN one_v_one_matches ovm2 ON mp2.match_id = ovm2.match_id
            WHERE mp2.player = ordered_matches.player 
              AND mp2.is_cpu = false 
              AND mp2.has_won = false
          ) sub
        )
      GROUP BY ordered_matches.player
    )
    
    -- Final query combining all CTEs
    SELECT 
      p.id,
      p.created_at,
      p.name,
      p.display_name,
      p.elo,
      p.country,
      p.picture,
      p.inactive,
      p.top_ten_played,
      COALESCE(mc.smash_character, NULL) as main_character,
      COALESCE(ps.total_wins, 0) as total_wins,
      COALESCE(ps.total_losses, 0) as total_losses,
      COALESCE(ps.total_kos, 0) as total_kos,
      COALESCE(ps.total_falls, 0) as total_falls,
      COALESCE(ps.total_sds, 0) as total_sds,
      COALESCE(ws.current_win_streak, 0) as current_win_streak,
      CASE WHEN p.top_ten_played >= 3 THEN true ELSE false END as is_ranked
    FROM players p
    LEFT JOIN main_chars mc ON p.id = mc.player AND mc.rn = 1
    LEFT JOIN player_stats ps ON p.id = ps.player
    LEFT JOIN win_streaks ws ON p.id = ws.player
    ORDER BY p.elo DESC;
    `;

    const result = (await prisma.$queryRawUnsafe(query)) as PlayerQueryResult[];

    // Transform BigInt values to numbers for JSON serialization
    const transformedPlayers = result.map((player) => ({
      id: Number(player.id),
      created_at: player.created_at.toISOString(),
      name: player.name,
      display_name: player.display_name,
      elo: Number(player.elo),
      inactive: player.inactive,
      is_ranked: player.is_ranked,
      top_ten_played: player.top_ten_played,
      country: player.country,
      picture: player.picture,
      main_character: player.main_character,
      total_wins: Number(player.total_wins),
      total_losses: Number(player.total_losses),
      total_kos: Number(player.total_kos),
      total_falls: Number(player.total_falls),
      total_sds: Number(player.total_sds),
      current_win_streak: Number(player.current_win_streak),
    }));

    return NextResponse.json(transformedPlayers);
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}
