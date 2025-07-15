import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Sample players to insert
    const samplePlayers = [
      { name: "alex_mario", display_name: "Alex", elo: 1850 },
      { name: "sarah_zelda", display_name: "Sarah", elo: 1720 },
      { name: "mike_pikachu", display_name: "Mike", elo: 1680 },
      { name: "emma_samus", display_name: "Emma", elo: 1550 },
      { name: "jake_link", display_name: "Jake", elo: 1480 },
      { name: "lisa_peach", display_name: "Lisa", elo: 1420 },
      { name: "tom_sonic", display_name: "Tom", elo: 1380 },
      { name: "amy_kirby", display_name: "Amy", elo: 1320 },
      { name: "dan_bowser", display_name: "Dan", elo: 1280 },
      { name: "kate_yoshi", display_name: "Kate", elo: 1150 },
      { name: "ryan_fox", display_name: "Ryan", elo: 1100 },
      { name: "zoe_lucina", display_name: "Zoe", elo: 980 },
    ];

    // Insert players using upsert
    for (const player of samplePlayers) {
      try {
        await prisma.players.upsert({
          where: { name: player.name },
          update: {
            display_name: player.display_name,
            elo: player.elo,
          },
          create: {
            name: player.name,
            display_name: player.display_name,
            elo: player.elo,
          },
        });
      } catch (error) {
        console.error(`Error upserting player ${player.name}:`, error);
      }
    }

    return NextResponse.json({
      message: "Database seeded successfully",
      playersCreated: samplePlayers.length,
    });
  } catch (error) {
    console.error("Error seeding database:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}