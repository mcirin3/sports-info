import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TeamLite = { id: number; name: string; code?: string; logo?: string };

type GameLite = {
  id: number;
  date: string;
  season: number;
  status: string;           // "NS" | "Q1".."Q4" | "OT" | "FT"
  period?: number;          // 1..4, 5+ OT
  clock?: string;           // "5:32"
  home: { team: TeamLite; score: number };
  away: { team: TeamLite; score: number };
  tv?: string[];
  gameUrl?: string;
};

// NFL season label helper (Jan playoffs still belong to last fall)
function nflSeasonForEspn(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0..11
  return m >= 7 ? y : y - 1; // Aug (7) or later -> this year, else previous
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const tz = searchParams.get("tz") || "America/New_York";
    const dateParam = searchParams.get("date");
    const weekParam = searchParams.get("week");
    const seasonParam = searchParams.get("season"); // "current" | "last" | "2024"
    const seasontype = searchParams.get("seasontype") ?? "2"; // 2=regular

    const liveOnly = searchParams.get("live") === "all";

    let season =
      !seasonParam || seasonParam === "current"
        ? nflSeasonForEspn()
        : seasonParam === "last"
        ? nflSeasonForEspn() - 1
        : Number(seasonParam);

    let url: string;

    if (weekParam) {
      // 🟢 Weekly view: all games for an NFL week in a season
      // ESPN pattern: ?dates=YYYY&seasontype=2&week=11
      const week = Number(weekParam);
      url =
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?` +
        new URLSearchParams({
          dates: String(season),
          seasontype,
          week: String(week),
          limit: "300",
        }).toString();
    } else {
      // 📅 Day view fallback (what you had before)
      const dateISO = dateParam || formatYMDinTZ(new Date(), tz);
      const espnDate = dateISO.replace(/-/g, "");
      url =
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?` +
        new URLSearchParams({
          dates: espnDate,
          limit: "300",
        }).toString();
    }

    const res = await fetch(url, { cache: "no-store", next: { revalidate: 10 } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `ESPN ${res.status}: ${text}` },
        { status: 502 }
      );
    }
    const json = await res.json();

    // Merge events from various shapes ESPN uses
    const rootEvents: any[] = Array.isArray(json?.events) ? json.events : [];
    const leaguesEvents: any[] = Array.isArray(json?.leagues?.[0]?.events)
      ? json.leagues[0].events
      : [];
    const sportsEvents: any[] = Array.isArray(json?.sports)
      ? json.sports.flatMap((s: any) =>
          Array.isArray(s?.leagues)
            ? s.leagues.flatMap((l: any) =>
                Array.isArray(l?.events) ? l.events : []
              )
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
      const live = games.filter((g) =>
        ["Q1", "Q2", "Q3", "Q4", "OT"].includes(g.status)
      );
      games = live.length ? live : games;
    }

    return NextResponse.json({ data: games });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "scores fetch failed" },
      { status: 500 }
    );
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
  const clock: string = String(s?.displayClock ?? "");

  const status =
    state === "pre"
      ? "NS"
      : state === "in"
      ? period >= 1 && period <= 4
        ? `Q${period}`
        : "OT"
      : /final/i.test(shortDetail)
      ? "FT"
      : "NS";

  const seasonYear =
    Number(ev?.season?.year) ||
    new Date(ev?.date ?? Date.now()).getFullYear();

  const broadcasts = Array.isArray(comp?.broadcasts) ? comp.broadcasts : [];
  const tv = broadcasts
    .flatMap((b: any) => (Array.isArray(b?.names) ? b.names : []))
    .filter(Boolean);

  const gameUrl = `https://www.espn.com/nfl/game/_/gameId/${ev?.id ?? ""}`;

  return {
    id: Number(ev?.id ?? Date.now()),
    date: ev?.date ?? new Date().toISOString(),
    season: seasonYear,
    status,
    period: state === "in" ? period : undefined,
    clock: state === "in" ? clock : "",
    home: { team: hTeam, score: hs },
    away: { team: aTeam, score: as },
    tv,
    gameUrl,
  };
}
