import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Valid cache tags that can be revalidated
const VALID_TAGS = ["players", "matches"] as const;
type ValidTag = (typeof VALID_TAGS)[number];

function isValidTag(tag: string): tag is ValidTag {
  return VALID_TAGS.includes(tag as ValidTag);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tags } = body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: "At least one tag must be provided" },
        { status: 400 }
      );
    }

    const invalidTags = tags.filter((tag: string) => !isValidTag(tag));
    if (invalidTags.length > 0) {
      return NextResponse.json(
        { error: `Invalid tags: ${invalidTags.join(", ")}. Valid tags are: ${VALID_TAGS.join(", ")}` },
        { status: 400 }
      );
    }

    for (const tag of tags) {
      revalidateTag(tag, "max");
    }

    console.log(`[Revalidate] Cache invalidated for tags: ${tags.join(", ")}`);

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      tags,
    });
  } catch (error) {
    console.error("[Revalidate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tagsParam = url.searchParams.get("tags");

    if (!tagsParam) {
      return NextResponse.json(
        { error: "No tags provided. Use ?tags=players,matches" },
        { status: 400 }
      );
    }

    const tags = tagsParam.split(",").map((t) => t.trim());

    if (tags.length === 0) {
      return NextResponse.json(
        { error: "At least one tag must be provided" },
        { status: 400 }
      );
    }

    const invalidTags = tags.filter((tag) => !isValidTag(tag));
    if (invalidTags.length > 0) {
      return NextResponse.json(
        { error: `Invalid tags: ${invalidTags.join(", ")}. Valid tags are: ${VALID_TAGS.join(", ")}` },
        { status: 400 }
      );
    }

    for (const tag of tags) {
      revalidateTag(tag, "max");
    }

    console.log(`[Revalidate] Cache invalidated for tags: ${tags.join(", ")}`);

    return NextResponse.json({
      revalidated: true,
      now: Date.now(),
      tags,
    });
  } catch (error) {
    console.error("[Revalidate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
