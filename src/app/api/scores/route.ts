// app(api)/scores/route.ts — ESPN scoreboard adapter
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TeamLite = { id: number; name: string; code?: string; logo?: string };
type GameLite = {
  id: number;
  date: string;
  season: number;
  status: string;           // "NS" | "Q1".."Q4" | "OT" | "FT"
  period?: number;          // NEW: 1..4, 5+ (OT), undefined when not live
  clock?: string;           // NEW: "5:32" etc., empty when not live
  home: { team: TeamLite; score: number };
  away: { team: TeamLite; score: number };
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Accept ?date=YYYY-MM-DD (optional) and ?tz=America/Chicago (optional)
    // ESPN schedules are keyed to US TV (ET) — default to New York
    const tz = searchParams.get("tz") || "America/New_York";
    const dateISO = searchParams.get("date") || formatYMDinTZ(new Date(), tz);
    const espnDate = dateISO.replace(/-/g, ""); // YYYYMMDD
    const liveOnly = searchParams.get("live") === "all";

    // ESPN scoreboard (undocumented). limit is harmless if ignored.
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${espnDate}&limit=300`;
    const res = await fetch(url, { next: { revalidate: 10 }, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `ESPN ${res.status}: ${text}` }, { status: 502 });
    }
    const json = await res.json();

    // Collect events from all shapes ESPN sometimes uses
    const rootEvents: any[] = Array.isArray(json?.events) ? json.events : [];
    const leaguesEvents: any[] = Array.isArray(json?.leagues?.[0]?.events) ? json.leagues[0].events : [];
    const sportsEvents: any[] = Array.isArray(json?.sports)
      ? json.sports.flatMap((s: any) =>
          Array.isArray(s?.leagues)
            ? s.leagues.flatMap((l: any) => (Array.isArray(l?.events) ? l.events : []))
            : []
        )
      : [];

    const byId = new Map<string, any>();
    for (const ev of [...rootEvents, ...leaguesEvents, ...sportsEvents]) {
      const id = String(ev?.id ?? "");
      if (id && !byId.has(id)) byId.set(id, ev);
    }
    let games: GameLite[] = Array.from(byId.values()).map(mapEspnEventToGame);

    if (liveOnly) {
      const isLive = (g: GameLite) => ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status);
      const live = games.filter(isLive);
      // optional UX fallback: if ESPN hasn't flipped state yet, show full slate
      games = live.length ? live : games;
    }

    return NextResponse.json({ data: games });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "scores fetch failed" }, { status: 500 });
  }
}

/* ----------------- helpers ----------------- */

// "YYYY-MM-DD" in a specific IANA timezone
function formatYMDinTZ(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const da = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${da}`;
}

function mapEspnEventToGame(ev: any): GameLite {
  const comp = ev?.competitions?.[0] ?? {};
  const comps = Array.isArray(comp?.competitors) ? comp.competitors : [];

  const home = comps.find((c: any) => c?.homeAway === "home") ?? comps[0] ?? {};
  const away = comps.find((c: any) => c?.homeAway === "away") ?? comps[1] ?? {};

  const hs = Number(home?.score ?? 0);
  const as = Number(away?.score ?? 0);

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

  const s = comp?.status ?? ev?.status ?? {};
  const period = Number(s?.period ?? 0);
  const state = String(s?.type?.state ?? "").toLowerCase(); // "pre" | "in" | "post"
  const shortDetail: string = s?.type?.shortDetail ?? "";
  const clock: string = String(s?.displayClock ?? "");       // "5:32" etc.

  const status =
    state === "pre" ? "NS" :
    state === "in"  ? (period >= 1 && period <= 4 ? `Q${period}` : "OT") :
    /final/i.test(shortDetail) ? "FT" : "NS";

  const seasonYear = Number(ev?.season?.year) || new Date(ev?.date ?? Date.now()).getFullYear();

  return {
    id: Number(ev?.id ?? Date.now()),
    date: ev?.date ?? new Date().toISOString(),
    season: seasonYear,
    status,
    period: state === "in" ? period : undefined,
    clock: state === "in" ? clock : "",
    home: { team: hTeam, score: hs },
    away: { team: aTeam, score: as },
  };
}
