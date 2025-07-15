import { NextResponse } from "next/server";

export async function POST() {
  try {
    // This endpoint is disabled to prevent accidental data loss
    return NextResponse.json({
      message: "Seed endpoint disabled",
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Endpoint disabled" },
      { status: 500 }
    );
  }
}