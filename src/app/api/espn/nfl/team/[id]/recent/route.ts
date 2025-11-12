import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

function nflSeasonForEspn(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth();
  return m >= 7 ? y : y - 1;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const id = params.id;
  const season = Number(searchParams.get("season") ?? nflSeasonForEspn());
  const seasontype = searchParams.get("seasontype") ?? "2";
  const limit = Number(searchParams.get("limit") ?? "5");

  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}/schedule?season=${season}&seasontype=${seasontype}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const text = await r.text().catch(()=> "");
    return NextResponse.json({ error: `ESPN ${r.status}: ${text}` }, { status: 502 });
  }
  const json = await r.json();

  const events: any[] = Array.isArray(json?.events) ? json.events : [];
  const finals = events
    .filter(e => (e?.status?.type?.completed ?? false) || /final/i.test(e?.status?.type?.description ?? ""))
    .slice(-limit);

  const games = finals.map(ev => {
    const comp = ev?.competitions?.[0] ?? {};
    const comps = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const me  = comps.find((c: any) => String(c?.team?.id) === String(id)) ?? comps[0] ?? {};
    const opp = comps.find((c: any) => String(c?.team?.id) !== String(id)) ?? comps[1] ?? {};
    const pf = Number(me?.score ?? 0), pa = Number(opp?.score ?? 0), won = Boolean(me?.winner);
    return { id: Number(ev?.id ?? 0), date: ev?.date, pf, pa, won };
  });

  const totals = games.reduce((a,g)=>({ pf:a.pf+g.pf, pa:a.pa+g.pa, w:a.w+(g.won?1:0) }), { pf:0, pa:0, w:0 });
  const n = games.length || 1;

  return NextResponse.json({
    teamId: Number(id),
    season, seasontype: Number(seasontype),
    sample: games.length,
    pfAvg: +(totals.pf / n).toFixed(1),
    paAvg: +(totals.pa / n).toFixed(1),
    recordLastN: `${totals.w}-${n - totals.w}`,
    games,
  });
}
