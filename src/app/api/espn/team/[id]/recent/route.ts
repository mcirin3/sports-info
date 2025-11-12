import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/espn/team/:id/recent?season=2025&seasontype=2&limit=5
 * Returns last N completed games (default 5) with PF/PA averages and W-L.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const id = params.id;
  const season = searchParams.get("season") ?? String(new Date().getFullYear());
  const seasontype = searchParams.get("seasontype") ?? "2";
  const limit = Number(searchParams.get("limit") ?? "5");

  const url =
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/schedule?` +
    new URLSearchParams({ season, seasontype }).toString();

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: `ESPN ${res.status}: ${text}` }, { status: 502 });
  }
  const json = await res.json();

  // ESPN gives "events" with competitions; take finished games only, newest last.
  const events: any[] = Array.isArray(json?.events) ? json.events : [];
  const finals = events
    .filter(e => (e?.status?.type?.completed ?? false) || /final/i.test(e?.status?.type?.description ?? ""))
    .slice(-limit);

  const games = finals.map(ev => {
    const comp = ev?.competitions?.[0] ?? {};
    const comps = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const me = comps.find((c: any) => String(c?.team?.id) === String(id)) ?? comps[0] ?? {};
    const opp = comps.find((c: any) => String(c?.team?.id) !== String(id)) ?? comps[1] ?? {};

    const pf = Number(me?.score ?? 0);
    const pa = Number(opp?.score ?? 0);
    const won = Boolean(me?.winner);

    return {
      id: Number(ev?.id ?? 0),
      date: ev?.date,
      homeAway: me?.homeAway ?? "home",
      opponent: {
        id: Number(opp?.team?.id ?? 0),
        name: opp?.team?.displayName ?? opp?.team?.name,
        logo: opp?.team?.logo ?? opp?.team?.logos?.[0]?.href,
      },
      pf, pa, won,
    };
  });

  const totals = games.reduce(
    (acc, g) => {
      acc.pf += g.pf;
      acc.pa += g.pa;
      acc.w += g.won ? 1 : 0;
      return acc;
    },
    { pf: 0, pa: 0, w: 0 }
  );

  const n = games.length || 1;
  return NextResponse.json({
    teamId: Number(id),
    season: Number(season),
    seasontype: Number(seasontype),
    sample: games.length,
    pfAvg: +(totals.pf / n).toFixed(1),
    paAvg: +(totals.pa / n).toFixed(1),
    recordLastN: `${totals.w}-${n - totals.w}`,
    games,
  });
}
