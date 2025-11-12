import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/espn/standings?season=2025&seasontype=2
 * seasontype: 1=pre, 2=regular, 3=post
 * Returns minimal standings map: teamId -> { confRank, wins, losses }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? String(new Date().getFullYear());
  const seasontype = searchParams.get("seasontype") ?? "2";

  // ESPN "v2" standings endpoint (not the "site" variant)
  const url =
    `https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings?` +
    new URLSearchParams({ season, seasontype, type: "0", level: "3" }).toString();

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `ESPN ${res.status}: ${text}` }, { status: 502 });
  }
  const json = await res.json();

  // The shape is verbose. Normalize to a flat map by team id.
  const table: Record<string, any> = {};

  const children = json?.children ?? []; // conferences -> divisions -> teams
  for (const conf of children) {
    for (const div of (conf?.children ?? [])) {
      for (const row of (div?.standings?.entries ?? [])) {
        const teamId = String(row?.team?.id ?? "");
        if (!teamId) continue;
        // record summary
        const stats = Object.fromEntries(
          (row?.stats ?? []).map((s: any) => [s?.name, s?.value ?? s?.displayValue])
        );
        // try to get rank from row (some payloads store rank on "overall" or "playoffseed")
        const rank =
          Number(stats?.playoffSeed ?? stats?.rank ?? row?.rank ?? NaN);

        table[teamId] = {
          teamId: Number(teamId),
          confRank: isFinite(rank) ? Number(rank) : undefined,
          wins: Number(stats?.wins ?? 0),
          losses: Number(stats?.losses ?? 0),
        };
      }
    }
  }

  return NextResponse.json({ season: Number(season), seasontype: Number(seasontype), data: table });
}
