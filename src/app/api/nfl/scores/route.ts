/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/nfl/scores/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  clampNflWeek,
  getCurrentNflWeek,
  nflSeasonStartDate,
  nflSeasonYearForDate,
} from "@/lib/nfl";

type TeamLite = { id: number; name: string; logo?: string };
type GameLite = {
  id: number;
  date: string;
  status: string;
  period?: number;
  clock?: string;
  home: { team: TeamLite; score: number };
  away: { team: TeamLite; score: number };
  tv?: string[];
  gameUrl?: string;
};

const MAX_WEEK = 18;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    const season = resolveSeason(searchParams.get("season"), now);
    const seasontype = searchParams.get("seasontype") ?? "2";
    const limitParam = Number(searchParams.get("limit") ?? "200");
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 200;

    const requestedWeek = Number(searchParams.get("week"));
    const week = clampNflWeek(
      Number.isFinite(requestedWeek) && requestedWeek > 0
        ? requestedWeek
        : getCurrentNflWeek(now),
      1,
      MAX_WEEK
    );

    const params = new URLSearchParams({
      week: String(week),
      limit: String(limit),
      year: String(season),
      seasontype,
    });

    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?${params.toString()}`;

    let events: any[] = [];
    let note: string | undefined;

    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      events = Array.isArray(json?.events) ? json.events : [];
    } else if (res.status === 404) {
      note = `No NFL scoreboard data for season ${season}, week ${week}.`;
    } else {
      const fallback = await fetchWeekByDates(
        season,
        week,
        limit,
        seasontype
      ).catch(() => null);
      if (fallback) {
        events = fallback.events;
        note = fallback.note;
      }
      if (!fallback) {
        const txt = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `ESPN ${res.status}: ${txt}` },
          { status: 502 }
        );
      }
    }

    const games: GameLite[] = events.map(mapEspnEventToGame);

    return NextResponse.json({
      week,
      season,
      seasontype: Number(seasontype),
      data: games,
      note,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function resolveSeason(seasonParam: string | null, now: Date) {
  if (!seasonParam || seasonParam === "current") return nflSeasonYearForDate(now);
  if (seasonParam === "last") return nflSeasonYearForDate(now) - 1;
  const parsed = Number(seasonParam);
  if (Number.isFinite(parsed) && parsed > 1900) return parsed;
  return nflSeasonYearForDate(now);
}

function mapEspnEventToGame(ev: any): GameLite {
  const comp = ev?.competitions?.[0] ?? {};
  const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
  const home =
    competitors.find((c: any) => c?.homeAway === "home") ??
    competitors[0] ??
    {};
  const away =
    competitors.find((c: any) => c?.homeAway === "away") ??
    competitors[1] ??
    {};

  const status = comp?.status ?? ev?.status ?? {};
  const state = String(status?.type?.state ?? "").toLowerCase();
  const period = Number(status?.period ?? 0);
  const shortDetail = status?.type?.shortDetail ?? status?.shortDetail ?? "";
  const detail = status?.type?.detail ?? status?.detail ?? "";
  const statusLabel = mapGameStatus(state, period, shortDetail, detail);

  const clockRaw = status?.displayClock ?? status?.clock ?? "";
  const clock =
    state === "in"
      ? String(clockRaw ?? shortDetail ?? detail ?? "")
      : undefined;

  const tv = collectBroadcasts(comp);
  const gameUrl = pickGamecastUrl(ev);

  return {
    id: Number(ev?.id ?? comp?.id ?? Date.now()),
    date: comp?.date ?? ev?.date ?? new Date().toISOString(),
    status: statusLabel,
    period: state === "in" && period > 0 ? period : undefined,
    clock,
    home: {
      team: mapTeam(home),
      score: Number(home?.score ?? 0),
    },
    away: {
      team: mapTeam(away),
      score: Number(away?.score ?? 0),
    },
    tv: tv.length ? tv : undefined,
    gameUrl,
  };
}

function mapTeam(side: any): TeamLite {
  const team = side?.team ?? {};
  return {
    id: Number(team?.id ?? 0),
    name: team?.displayName ?? team?.name ?? "Team",
    logo: team?.logo ?? team?.logos?.[0]?.href ?? undefined,
  };
}

function mapGameStatus(
  state: string,
  period: number,
  shortDetail: string,
  detail: string
) {
  if (state === "pre") return "NS";
  if (state === "post") return "FT";
  if (state === "in") {
    if (period >= 1 && period <= 4) return `Q${period}`;
    if (period >= 5) return "OT";
    return "Q1";
  }
  if (/final/i.test(shortDetail) || /final/i.test(detail)) return "FT";
  return "NS";
}

function pickGamecastUrl(ev: any) {
  const links = Array.isArray(ev?.links) ? ev.links : [];
  const matchText = links.find((l: any) =>
    typeof l?.text === "string" && /gamecast/i.test(l.text)
  );
  if (matchText?.href) return matchText.href;

  const matchRel = links.find((l: any) =>
    Array.isArray(l?.rel) &&
    l.rel.some(
      (rel: any) => typeof rel === "string" && /gamecast/i.test(rel)
    )
  );
  return matchRel?.href;
}

function collectBroadcasts(comp: any) {
  const pickName = (b: any) =>
    b?.media?.shortName ??
    b?.media?.name ??
    b?.type?.shortName ??
    b?.type?.description ??
    b?.market?.name ??
    "";

  const geo = Array.isArray(comp?.geoBroadcasts) ? comp.geoBroadcasts : [];
  const geoNames = geo.map(pickName).filter(Boolean);
  if (geoNames.length) return geoNames;

  const broadcasts = Array.isArray(comp?.broadcasts) ? comp.broadcasts : [];
  return broadcasts.map(pickName).filter(Boolean);
}

async function fetchWeekByDates(
  season: number,
  week: number,
  limit: number,
  seasontype: string
) {
  const kickoff = nflSeasonStartDate(season);
  const start = new Date(
    kickoff.getTime() + Math.max(0, week - 1) * 7 * 24 * 60 * 60 * 1000
  );

  const dates = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    dates.add(formatYMD(d));
  }

  const events: any[] = [];
  const seen = new Set<string>();
  for (const ymd of dates) {
    const params = new URLSearchParams({
      dates: ymd,
      limit: String(limit),
      year: String(season),
      seasontype,
    });
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) continue;
    const json = await res.json();
    const dayEvents: any[] = Array.isArray(json?.events) ? json.events : [];
    for (const ev of dayEvents) {
      const id = String(ev?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      events.push(ev);
    }
  }

  return {
    events,
    note: events.length
      ? `Week ${week} (${season}) fetched via date-based fallback`
      : `Week ${week} (${season}) not published on ESPN scoreboard.`,
  };
}

function formatYMD(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
