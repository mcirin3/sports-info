import { NextRequest, NextResponse } from "next/server";

/**
 * Quick ESPN adapter for today's NBA scoreboard (or a specific date).
 * ESPN endpoint (undocumented): https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
 * Accepts ?date=YYYY-MM-DD (ours) or ?dates=YYYYMMDD (ESPN).
 */
type TeamLite = { id: number; name: string; code?: string; logo?: string };
type GameLite = {
  id: number;
  date: string;
  season: number;
  status: string; // "NS" | "Q1".."Q4" | "OT" | "FT"
  home: { team: TeamLite; score: number };
  away: { team: TeamLite; score: number };
};

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateISO = searchParams.get("date") ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const espnDate = dateISO.replace(/-/g, ""); // YYYYMMDD

    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDate}`;
    const res = await fetch(url, { next: { revalidate: 10 } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `ESPN ${res.status}: ${text}` }, { status: 502 });
    }
    const json = await res.json();

    // ESPN: json.events[]; each event has competitions[0].competitors (home/away), status, etc.
    const events: any[] = json?.events ?? [];
    const data: GameLite[] = events.map(mapEspnEventToGame);

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "scoreboard failed" }, { status: 500 });
  }
}

function mapEspnEventToGame(ev: any): GameLite {
  const comp = ev?.competitions?.[0] ?? {};
  const comps = comp?.competitors ?? [];

  // Identify home/away competitors
  const home = comps.find((c: any) => c?.homeAway === "home") ?? comps[0];
  const away = comps.find((c: any) => c?.homeAway === "away") ?? comps[1];

  // Scores come as strings; coerce to numbers
  const hs = Number(home?.score ?? 0);
  const as = Number(away?.score ?? 0);

  // Team info
  const hTeam: TeamLite = {
    id: Number(home?.team?.id ?? 0),
    name: home?.team?.displayName ?? home?.team?.name ?? "Home",
    code: home?.team?.abbreviation ?? undefined,
    logo: home?.team?.logo ?? home?.team?.logos?.[0]?.href ?? undefined,
  };
  const aTeam: TeamLite = {
    id: Number(away?.team?.id ?? 0),
    name: away?.team?.displayName ?? away?.team?.name ?? "Away",
    code: away?.team?.abbreviation ?? undefined,
    logo: away?.team?.logo ?? away?.team?.logos?.[0]?.href ?? undefined,
  };

  // Status mapping
  const s = comp?.status ?? ev?.status ?? {};
  const period = s?.period ?? 0;
  const state = (s?.type?.state ?? "").toLowerCase(); // "pre" | "in" | "post"
  const shortDetail: string = s?.type?.shortDetail ?? "";
  const status = mapEspnStatus(state, period, shortDetail);

  // Season
  const seasonYear =
    Number(ev?.season?.year) ||
    new Date(ev?.date ?? Date.now()).getFullYear();

  return {
    id: Number(ev?.id ?? Date.now()),
    date: ev?.date ?? new Date().toISOString(),
    season: seasonYear,
    status,
    home: { team: hTeam, score: hs },
    away: { team: aTeam, score: as },
  };
}

function mapEspnStatus(state: string, period: number, shortDetail: string): string {
  if (state === "pre") return "NS";
  if (state === "post") return shortDetail.includes("Final") ? "FT" : "FT";
  // in-progress
  if (state === "in") {
    if (period >= 1 && period <= 4) return `Q${period}`;
    if (period >= 5) return "OT";
    return "Q1";
  }
  // fallback
  if (/final/i.test(shortDetail)) return "FT";
  return "NS";
}
