import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// NFL season label = starting year (e.g., Jan 2026 playoffs still season 2025)
function nflSeasonForEspn(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth();      // 0..11
  return m >= 7 ? y : y - 1;                        // Aug (7) or later -> current year, else previous
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const season = Number(searchParams.get("season") ?? nflSeasonForEspn());
  const seasontype = searchParams.get("seasontype") ?? "2"; // 2=regular

  const url = `https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?season=${season}&seasontype=${seasontype}&type=0&level=3`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const text = await r.text().catch(()=> "");
    return NextResponse.json({ error: `ESPN ${r.status}: ${text}` }, { status: 502 });
  }
  const json = await r.json();

  const table: Record<string, any> = {};
  for (const conf of json?.children ?? []) {
    for (const div of conf?.children ?? []) {
      for (const row of div?.standings?.entries ?? []) {
        const id = String(row?.team?.id ?? "");
        if (!id) continue;
        const stats = Object.fromEntries((row?.stats ?? []).map((s: any) => [s?.name, s?.value ?? s?.displayValue]));
        const rank = Number(stats?.playoffSeed ?? row?.rank ?? stats?.rank ?? NaN);
        table[id] = {
          teamId: Number(id),
          confRank: isFinite(rank) ? rank : undefined,
          wins: Number(stats?.wins ?? 0),
          losses: Number(stats?.losses ?? 0),
        };
      }
    }
  }
  return NextResponse.json({ season, seasontype: Number(seasontype), data: table });
}
