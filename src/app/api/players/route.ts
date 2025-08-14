import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface PlayerQueryResult {
  id: bigint;
  created_at: Date;
  name: string;
  display_name: string | null;
  elo: bigint;
  country: string | null;
  main_character: string | null;
  total_wins: bigint;
  total_losses: bigint;
  total_kos: bigint;
  total_falls: bigint;
  total_sds: bigint;
  current_win_streak: bigint;
  top_10_players_played: bigint;
  is_ranked: boolean;
}

export async function GET() {
  try {
    // Optimized single query that does all calculations in PostgreSQL
    const query = `
    WITH 
    -- First get potential top players, then filter to those who played 3+ top opponents
    potential_top_players AS (
      SELECT p.id, p.elo,
        COUNT(DISTINCT opponent.player) as opponents_in_potential_top
      FROM players p
      LEFT JOIN match_participants mp1 ON p.id = mp1.player AND mp1.is_cpu = false
      LEFT JOIN match_participants opponent ON mp1.match_id = opponent.match_id 
        AND opponent.player != p.id AND opponent.is_cpu = false
      LEFT JOIN matches m ON mp1.match_id = m.id
      LEFT JOIN (
        SELECT mp_inner.match_id 
        FROM match_participants mp_inner 
        WHERE mp_inner.is_cpu = false 
        GROUP BY mp_inner.match_id 
        HAVING COUNT(*) = 2
      ) one_v_one ON m.id = one_v_one.match_id
      LEFT JOIN players opponent_player ON opponent.player = opponent_player.id
      WHERE one_v_one.match_id IS NOT NULL
        AND opponent_player.id IN (
          SELECT inner_p.id FROM players inner_p ORDER BY inner_p.elo DESC LIMIT 15
        )
      GROUP BY p.id, p.elo
    ),
    top_10_players AS (
      SELECT id FROM potential_top_players
      WHERE opponents_in_potential_top >= 3
      ORDER BY elo DESC
      LIMIT 10
    ),
    
    -- Get 1v1 matches only (exactly 2 non-CPU participants)
    one_v_one_matches AS (
      SELECT DISTINCT m.id as match_id
      FROM matches m
      JOIN match_participants mp ON m.id = mp.match_id
      WHERE mp.is_cpu = false
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
    ),
    
    -- Top 10 players played against count
    top_10_opponents AS (
      SELECT 
        mp1.player,
        COUNT(DISTINCT mp2.player) as top_10_players_played
      FROM match_participants mp1
      JOIN one_v_one_matches ovm ON mp1.match_id = ovm.match_id
      JOIN match_participants mp2 ON mp1.match_id = mp2.match_id
      JOIN top_10_players t10 ON mp2.player = t10.id
      WHERE mp1.is_cpu = false 
        AND mp2.is_cpu = false 
        AND mp1.player != mp2.player
      GROUP BY mp1.player
    )
    
    -- Final query combining all CTEs
    SELECT 
      p.id,
      p.created_at,
      p.name,
      p.display_name,
      p.elo,
      p.country,
      COALESCE(mc.smash_character, NULL) as main_character,
      COALESCE(ps.total_wins, 0) as total_wins,
      COALESCE(ps.total_losses, 0) as total_losses,
      COALESCE(ps.total_kos, 0) as total_kos,
      COALESCE(ps.total_falls, 0) as total_falls,
      COALESCE(ps.total_sds, 0) as total_sds,
      COALESCE(ws.current_win_streak, 0) as current_win_streak,
      COALESCE(t10o.top_10_players_played, 0) as top_10_players_played,
      CASE WHEN COALESCE(t10o.top_10_players_played, 0) >= 3 THEN true ELSE false END as is_ranked
    FROM players p
    LEFT JOIN main_chars mc ON p.id = mc.player AND mc.rn = 1
    LEFT JOIN player_stats ps ON p.id = ps.player
    LEFT JOIN win_streaks ws ON p.id = ws.player
    LEFT JOIN top_10_opponents t10o ON p.id = t10o.player
    ORDER BY p.elo DESC;
    `;

    const result = await prisma.$queryRawUnsafe(query) as PlayerQueryResult[];
    
    // Transform BigInt values to numbers for JSON serialization
    const transformedPlayers = result.map((player) => ({
      id: Number(player.id),
      created_at: player.created_at.toISOString(),
      name: player.name,
      display_name: player.display_name,
      elo: Number(player.elo),
      is_ranked: player.is_ranked,
      top_10_players_played: Number(player.top_10_players_played),
      country: player.country,
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