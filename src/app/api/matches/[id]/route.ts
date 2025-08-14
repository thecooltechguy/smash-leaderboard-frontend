import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchId = parseInt(id);

    if (isNaN(matchId)) {
      return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
    }

    // Get the specific match with participants
    const match = await prisma.matches.findUnique({
      where: {
        id: BigInt(matchId),
      },
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
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Transform the data to match the frontend interface
    const transformedMatch = {
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
    };

    return NextResponse.json(transformedMatch);
  } catch (error) {
    console.error("Error fetching match:", error);
    return NextResponse.json(
      { error: "Failed to fetch match" },
      { status: 500 }
    );
  }
}
