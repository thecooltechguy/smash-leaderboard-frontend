import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
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

interface TransformedPlayer {
  id: number;
  created_at: string;
  name: string;
  display_name: string | null;
  elo: number;
  inactive: boolean;
  is_ranked: boolean;
  top_ten_played: number;
  country: string | null;
  picture: string | null;
  main_character: string | null;
  total_wins: number;
  total_losses: number;
  total_kos: number;
  total_falls: number;
  total_sds: number;
  current_win_streak: number;
  last_match_date: string | null;
}

async function fetchPlayersFromDb(): Promise<TransformedPlayer[]> {
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
    last_match_date: player.last_match_date
      ? player.last_match_date.toISOString()
      : null,
  }));

  return transformedPlayers;
}

// Cache the expensive query - only revalidated when "players" tag is invalidated
const getCachedPlayers = unstable_cache(
  fetchPlayersFromDb,
  ["players-data"],
  {
    tags: ["players"],
    // No automatic revalidation - only on-demand via revalidateTag("players")
  }
);

export async function GET() {
  try {
    console.log("[GET /api/players] Fetching players (cached)...");

    const players = await getCachedPlayers();

    console.log(
      "[GET /api/players] Returning",
      players.length,
      "players"
    );

    return NextResponse.json(players);
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
