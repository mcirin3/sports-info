import { NextRequest, NextResponse } from "next/server";
import { nbaTeamIdToEspnId } from "@/lib/teamMap";

type ESPNScoreValue =
  | number
  | string
  | { value?: number | string; displayValue?: number | string };

type ESPNCompetitor = {
  team?: { id?: number | string; displayName?: string; name?: string; logo?: string; logos?: { href?: string }[] };
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

/**
 * GET /api/espn/team/:id/recent?season=2025&seasontype=2&limit=5
 * Returns last N completed games (default 5) with PF/PA averages and W-L.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(req.url);
  const { id: rawId } = await params;
  const id = normalizeEspnTeamId(rawId);
  const requestedSeason = searchParams.get("season");
  const seasontype = searchParams.get("seasontype") ?? "2";
  const limit = Number(searchParams.get("limit") ?? "5");

  const currentLabel = seasonLabelForEspn();
  const primarySeason = resolveSeason(requestedSeason, currentLabel);
  const fallbackSeason =
    primarySeason > currentLabel
      ? currentLabel
      : Math.max(primarySeason - 1, 2000);

  const seasonsToTry = Array.from(
    new Set(
      [primarySeason, fallbackSeason].filter(
        (season) => Number.isFinite(season) && season > 0
      )
    )
  );

  let activeSeason = primarySeason;
  let payload: ESPNTeamScheduleResponse | null = null;
  let lastStatus = 0;
  let lastErrorText = "";

  for (const season of seasonsToTry) {
    const url =
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/schedule?` +
      new URLSearchParams({ season: String(season), seasontype }).toString();

    const res = await fetch(url, { cache: "no-store" });
    lastStatus = res.status;
    if (res.ok) {
      payload = await res.json();
      activeSeason = season;
      break;
    }
    lastErrorText = await res.text().catch(() => "");
  }

  if (!payload) {
    const suffix = lastErrorText ? `${lastStatus}: ${lastErrorText}` : "fetch failed";
    return NextResponse.json(
      { error: `ESPN ${suffix}` },
      { status: 502 }
    );
  }

  // ESPN gives "events" with competitions; take finished games only, newest last.
  const events: ESPNEvent[] = Array.isArray(payload?.events)
    ? (payload.events as ESPNEvent[])
    : [];
  const finals = events
    .filter((event) => isCompletedEvent(event))
    .slice(-limit);

  const games = finals.map((ev) => {
    const comp = ev?.competitions?.[0];
    const comps = Array.isArray(comp?.competitors)
      ? (comp?.competitors as ESPNCompetitor[])
      : [];
    const me =
      comps.find((c) => String(c?.team?.id) === String(id)) ?? comps[0];
    const opp =
      comps.find((c) => String(c?.team?.id) !== String(id)) ?? comps[1];

    const pf = extractScore(me);
    const pa = extractScore(opp);
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
      pf,
      pa,
      won,
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
    season: Number(activeSeason),
    seasontype: Number(seasontype),
    sample: games.length,
    pfAvg: +(totals.pf / n).toFixed(1),
    paAvg: +(totals.pa / n).toFixed(1),
    recordLastN: `${totals.w}-${n - totals.w}`,
    games,
  });
}

function normalizeEspnTeamId(id: string) {
  const asNumber = Number(id);
  if (!Number.isFinite(asNumber)) return Number(id);
  return nbaTeamIdToEspnId[asNumber] ?? asNumber;
}

function seasonLabelForEspn(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0..11
  return month >= 8 ? year + 1 : year;
}

function resolveSeason(seasonParam: string | null, currentLabel: number) {
  const parsed = Number(seasonParam);
  if (!Number.isFinite(parsed)) return currentLabel;
  if (parsed > currentLabel) return currentLabel;
  return parsed;
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

function isCompletedEvent(event: ESPNEvent) {
  const compStatus = event?.competitions?.[0]?.status?.type;
  const eventStatus = event?.status?.type;
  if (
    compStatus?.completed ||
    compStatus?.state === "post" ||
    eventStatus?.completed ||
    eventStatus?.state === "post"
  ) {
    return true;
  }
  const desc =
    compStatus?.description ||
    eventStatus?.description ||
    compStatus?.detail ||
    eventStatus?.detail ||
    "";
  return /final/i.test(String(desc));
}
