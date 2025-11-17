// app/api/nba/game/[id]/intel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { nbaTeamIdToEspnId } from "@/lib/teamMap";

type ESPNScoreValue =
  | number
  | string
  | { value?: number | string; displayValue?: number | string };

type ESPNCompetitor = {
  id?: number | string;
  team?: { id?: number | string };
  score?: ESPNScoreValue;
  homeAway?: string;
  winner?: boolean;
};

type ESPNCompetitionStatus = {
  completed?: boolean;
  state?: string;
  description?: string;
  detail?: string;
};

type ESPNCompetition = {
  competitors?: ESPNCompetitor[];
  status?: { type?: ESPNCompetitionStatus };
};

type ESPNEvent = {
  id?: string | number;
  date?: string;
  competitions?: ESPNCompetition[];
  status?: { type?: ESPNCompetitionStatus };
};

type ESPNTeamScheduleResponse = {
  events?: ESPNEvent[];
};

export const dynamic = "force-dynamic";

type TeamRecentSummary = {
  espnId: number;
  lastNGames: number;
  avgPF: number;
  avgPA: number;
  recordLastN: string;
};

async function fetchTeamRecent(
  espnId: number,
  limit: number
): Promise<TeamRecentSummary> {
  const currentSeason = seasonLabelForEspn();
  const seasonsToTry = Array.from(
    new Set([currentSeason, currentSeason - 1].filter((s) => s > 0))
  );
  const seasontype = "2";

  let payload: ESPNTeamScheduleResponse | null = null;
  let lastError = "";

  for (const season of seasonsToTry) {
    const url =
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnId}/schedule?` +
      new URLSearchParams({
        season: String(season),
        seasontype,
      }).toString();

    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      payload = await res.json();
      break;
    }
    lastError = await res.text().catch(() => `ESPN ${res.status}`);
  }

  if (!payload) {
    throw new Error(lastError || "ESPN schedule unavailable");
  }

  const events: ESPNEvent[] = Array.isArray(payload?.events)
    ? (payload.events as ESPNEvent[])
    : [];
  const finals = events.filter(isCompletedEvent).slice(-limit);

  let pf = 0;
  let pa = 0;
  let wins = 0;

  for (const ev of finals) {
    const comp = ev.competitions?.[0];
    const competitors = Array.isArray(comp?.competitors)
      ? (comp?.competitors as ESPNCompetitor[])
      : [];

    const me = competitors.find(
      (c) => Number(c?.team?.id ?? c?.id) === espnId
    );
    const opp = competitors.find(
      (c) => Number(c?.team?.id ?? c?.id) !== espnId
    );

    const myScore = extractScore(me);
    const oppScore = extractScore(opp);

    pf += myScore;
    pa += oppScore;

    if (myScore > oppScore) wins++;
  }

  return {
    espnId,
    lastNGames: finals.length,
    avgPF: finals.length ? pf / finals.length : 0,
    avgPA: finals.length ? pa / finals.length : 0,
    recordLastN: `${wins}-${finals.length - wins}`,
  };
}

/**
 * Simple scoring differential model
 */
function computeEdge(home: TeamRecentSummary, away: TeamRecentSummary) {
  const hForm = home.avgPF - home.avgPA;
  const aForm = away.avgPF - away.avgPA;

  const diff = hForm - aForm;

  // Logistic transform
  const p = 1 / (1 + Math.exp(-diff / 5));

  return {
    homeWinProb: Number(p.toFixed(3)),
    awayWinProb: Number((1 - p).toFixed(3)),
    reason:
      p >= 0.5
        ? "Home team holds the edge based on recent performance trends."
        : "Away team holds the edge based on recent performance trends.",
  };
}

/**
 * MAIN ROUTE
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;

  const { searchParams } = new URL(req.url);
  const homeId = normalizeEspnTeamId(searchParams.get("home"));
  const awayId = normalizeEspnTeamId(searchParams.get("away"));
  const limit = Number(searchParams.get("limit") ?? 5);

  if (!homeId || !awayId || isNaN(homeId) || isNaN(awayId)) {
    return NextResponse.json(
      { error: "Missing or invalid ESPN team IDs: ?home=X&away=Y" },
      { status: 400 }
    );
  }

  try {
    // Fetch recent-game data for both teams
    const [home, away] = await Promise.all([
      fetchTeamRecent(homeId, limit),
      fetchTeamRecent(awayId, limit),
    ]);

    const edge = computeEdge(home, away);

    return NextResponse.json({
      gameId: Number(gameId),
      home,
      away,
      edge,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "intel route failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function normalizeEspnTeamId(value: string | number | null) {
  const num = Number(value);
  if (!Number.isFinite(num)) return NaN;
  return nbaTeamIdToEspnId[num] ?? num;
}

function seasonLabelForEspn(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  return month >= 8 ? year + 1 : year;
}

function isCompletedEvent(ev: ESPNEvent) {
  const compStatus = ev?.competitions?.[0]?.status?.type;
  const eventStatus = ev?.status?.type;

  const completed =
    compStatus?.completed ||
    compStatus?.state === "post" ||
    eventStatus?.completed ||
    eventStatus?.state === "post";

  if (completed) return true;

  const desc =
    compStatus?.description ||
    eventStatus?.description ||
    compStatus?.detail ||
    eventStatus?.detail ||
    "";
  return /final/i.test(String(desc));
}

function extractScore(comp: ESPNCompetitor | undefined) {
  if (!comp) return 0;
  const raw = comp.score;
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }
  if (typeof raw === "object") {
    const value = raw.value ?? raw.displayValue;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
}
