import { NextRequest, NextResponse } from "next/server";
import { buildWatchUrl } from "@/lib/watch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "nba";
  const team = searchParams.get("team");

  if (!team) {
    return NextResponse.json({ error: "Missing team name" }, { status: 400 });
  }

  const url = buildWatchUrl({
    base: process.env.WATCH_BASE_URL || "",
    sport,
    team,
  });

  if (!url) {
    return NextResponse.json({ error: "WATCH_BASE_URL not configured" }, { status: 500 });
  }

  return NextResponse.json({ url });
}
