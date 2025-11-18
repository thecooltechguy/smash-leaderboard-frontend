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
  last_match_date: Date | null;
}

export async function GET() {
  try {
    console.log("[GET /api/players] Starting player fetch...");
    console.log("[GET /api/players] Database connection check...");
    
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
    -- First, get all matches ordered for each player
    ordered_player_matches AS (
      SELECT 
        mp.player,
        mp.has_won,
        ROW_NUMBER() OVER (PARTITION BY mp.player ORDER BY m.created_at DESC, m.id DESC) as match_order
      FROM match_participants mp
      JOIN one_v_one_matches ovm ON mp.match_id = ovm.match_id
      JOIN matches m ON mp.match_id = m.id
      WHERE mp.is_cpu = false
    ),
    -- Find the first loss for each player
    first_losses AS (
      SELECT 
        player,
        MIN(match_order) as first_loss_order
      FROM ordered_player_matches
      WHERE has_won = false
      GROUP BY player
    ),
    -- Calculate win streak: count wins before first loss
    win_streaks AS (
      SELECT 
        opm.player,
        COUNT(*) as current_win_streak
      FROM ordered_player_matches opm
      LEFT JOIN first_losses fl ON opm.player = fl.player
      WHERE opm.has_won = true
        AND (fl.first_loss_order IS NULL OR opm.match_order < fl.first_loss_order)
      GROUP BY opm.player
    ),
    
    -- Last match date for each player (from all matches, not just 1v1)
    last_match_dates AS (
      SELECT 
        mp.player,
        MAX(m.created_at) as last_match_date
      FROM match_participants mp
      JOIN matches m ON mp.match_id = m.id
      WHERE mp.is_cpu = false AND m.archived = false
      GROUP BY mp.player
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
      CASE WHEN p.top_ten_played >= 3 THEN true ELSE false END as is_ranked,
      lmd.last_match_date
    FROM players p
    LEFT JOIN main_chars mc ON p.id = mc.player AND mc.rn = 1
    LEFT JOIN player_stats ps ON p.id = ps.player
    LEFT JOIN win_streaks ws ON p.id = ws.player
    LEFT JOIN last_match_dates lmd ON p.id = lmd.player
    ORDER BY p.elo DESC;
    `;

    console.log("[GET /api/players] Executing query...");
    console.log("[GET /api/players] Query length:", query.length, "characters");
    
    // Debug: Check player 21's recent matches for win streak calculation
    const debugQuery = `
      WITH one_v_one_matches AS (
        SELECT DISTINCT m.id as match_id
        FROM matches m
        JOIN match_participants mp ON m.id = mp.match_id
        WHERE mp.is_cpu = false AND m.archived = false
        GROUP BY m.id
        HAVING COUNT(*) = 2
      )
      SELECT 
        mp.player,
        m.id as match_id,
        m.created_at,
        mp.has_won,
        ROW_NUMBER() OVER (PARTITION BY mp.player ORDER BY m.created_at DESC, m.id DESC) as match_order
      FROM match_participants mp
      JOIN one_v_one_matches ovm ON mp.match_id = ovm.match_id
      JOIN matches m ON mp.match_id = m.id
      WHERE mp.is_cpu = false AND mp.player = 21
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT 10;
    `;
    
    try {
      const debugResult = await prisma.$queryRawUnsafe(debugQuery) as Array<{
        player: bigint;
        match_id: bigint;
        created_at: Date;
        has_won: boolean;
        match_order: number;
      }>;
      console.log("[GET /api/players] Debug - Player 21 (Haseab) recent matches:", debugResult.map(r => ({
        match_id: r.match_id.toString(),
        created_at: r.created_at.toISOString(),
        has_won: r.has_won,
        match_order: r.match_order,
      })));
    } catch (debugError) {
      console.error("[GET /api/players] Debug query failed:", debugError);
    }
    
    const result = (await prisma.$queryRawUnsafe(query)) as PlayerQueryResult[];
    
    console.log("[GET /api/players] Query executed successfully");
    console.log("[GET /api/players] Result count:", result?.length || 0);
    
    if (result && result.length > 0) {
      console.log("[GET /api/players] Sample first player:", {
        id: result[0].id?.toString(),
        name: result[0].name,
        elo: result[0].elo?.toString(),
        current_win_streak: result[0].current_win_streak?.toString(),
        total_wins: result[0].total_wins?.toString(),
        has_win_streak: result[0].current_win_streak !== undefined && result[0].current_win_streak !== null,
      });
      
      if (result.length >= 3) {
        console.log("[GET /api/players] Third player (index 2):", {
          id: result[2].id?.toString(),
          name: result[2].name,
          elo: result[2].elo?.toString(),
          current_win_streak: result[2].current_win_streak?.toString(),
          current_win_streak_raw: result[2].current_win_streak,
          current_win_streak_type: typeof result[2].current_win_streak,
          total_wins: result[2].total_wins?.toString(),
          total_losses: result[2].total_losses?.toString(),
          has_win_streak: result[2].current_win_streak !== undefined && result[2].current_win_streak !== null,
        });
      }
      
      if (result.length >= 4) {
        console.log("[GET /api/players] Fourth player (index 3):", {
          id: result[3].id?.toString(),
          name: result[3].name,
          elo: result[3].elo?.toString(),
          current_win_streak: result[3].current_win_streak?.toString(),
          current_win_streak_raw: result[3].current_win_streak,
          current_win_streak_type: typeof result[3].current_win_streak,
          total_wins: result[3].total_wins?.toString(),
          total_losses: result[3].total_losses?.toString(),
          has_win_streak: result[3].current_win_streak !== undefined && result[3].current_win_streak !== null,
        });
      }
    }

    // Transform BigInt values to numbers for JSON serialization
    console.log("[GET /api/players] Starting transformation...");
    let transformedCount = 0;
    const transformedPlayers = result.map((player, index) => {
      try {
        transformedCount++;
        if (index === 0) {
          console.log("[GET /api/players] Transforming first player:", {
            id: player.id?.toString(),
            current_win_streak_raw: player.current_win_streak?.toString(),
            current_win_streak_type: typeof player.current_win_streak,
          });
        }
        return {
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
          last_match_date: player.last_match_date ? player.last_match_date.toISOString() : null,
        };
      } catch (transformError) {
        console.error(`[GET /api/players] Error transforming player at index ${index}:`, {
          error: transformError,
          player_id: player.id?.toString(),
          player_name: player.name,
        });
        throw transformError;
      }
    });

    console.log("[GET /api/players] Transformation complete. Transformed:", transformedCount, "players");
    
    if (transformedPlayers.length > 0) {
      console.log("[GET /api/players] Sample transformed player (first):", {
        id: transformedPlayers[0].id,
        name: transformedPlayers[0].name,
        current_win_streak: transformedPlayers[0].current_win_streak,
        current_win_streak_type: typeof transformedPlayers[0].current_win_streak,
      });
      
      if (transformedPlayers.length >= 3) {
        console.log("[GET /api/players] Sample transformed player (third):", {
          id: transformedPlayers[2].id,
          name: transformedPlayers[2].name,
          current_win_streak: transformedPlayers[2].current_win_streak,
          current_win_streak_type: typeof transformedPlayers[2].current_win_streak,
          total_wins: transformedPlayers[2].total_wins,
          total_losses: transformedPlayers[2].total_losses,
        });
      }
      
      if (transformedPlayers.length >= 4) {
        console.log("[GET /api/players] Sample transformed player (fourth):", {
          id: transformedPlayers[3].id,
          name: transformedPlayers[3].name,
          current_win_streak: transformedPlayers[3].current_win_streak,
          current_win_streak_type: typeof transformedPlayers[3].current_win_streak,
          total_wins: transformedPlayers[3].total_wins,
          total_losses: transformedPlayers[3].total_losses,
        });
      }
    }

    console.log("[GET /api/players] Returning response with", transformedPlayers.length, "players");
    return NextResponse.json(transformedPlayers);
  } catch (error) {
    console.error("[GET /api/players] Error fetching players:", error);
    const errorWithMeta = error as Error & { meta?: unknown; code?: string };
    const errorDetails: Record<string, unknown> = {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    if (errorWithMeta.meta) {
      errorDetails.meta = errorWithMeta.meta;
    }
    if (errorWithMeta.code) {
      errorDetails.code = errorWithMeta.code;
    }
    console.error("[GET /api/players] Error details:", errorDetails);
    return NextResponse.json(
      { 
        error: "Failed to fetch players",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
