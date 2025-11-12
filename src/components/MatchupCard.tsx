"use client";

import useSWR from "swr";
import { useMemo } from "react";

type Recent = {
  teamId: number;
  pfAvg: number;   // points for (last N)
  paAvg: number;   // points against (last N)
  recordLastN: string; // "W-L"
  sample: number;  // N
};

type StandRow = { confRank?: number; wins?: number; losses?: number };
type StandPayload = { data: Record<string, StandRow> };

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ESPN season label helper (prevents "last season" fetch)
function nbaSeasonForEspn(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0..11
  return m >= 8 ? y + 1 : y; // Aug or later -> next label year
}

// Parse "W-L" -> {w,l}
function parseWL(wl?: string) {
  const [w, l] = (wl ?? "").split("-").map((n) => Number(n));
  return { w: Number.isFinite(w) ? w : 0, l: Number.isFinite(l) ? l : 0 };
}

// Simple logistic blend: season win%, last-5 win%, and PF-PA differential
function computeHomeWinProb(
  homeSeasonWP: number, awaySeasonWP: number,
  homeLast5WP: number,  awayLast5WP: number,
  homePFminusPA: number, awayPFminusPA: number
) {
  const seasonDiff = homeSeasonWP - awaySeasonWP;             // -1..+1
  const recentDiff = homeLast5WP  - awayLast5WP;              // -1..+1
  const formPts    = (homePFminusPA - awayPFminusPA);         // in points

  // Weighted score -> logistic probability
  // Tune factors to taste; these are sane MVP defaults.
  const z = 1.4 * seasonDiff + 1.0 * recentDiff + 0.04 * formPts + 0.12; // +0.12 ≈ small home-court bias
  const p = 1 / (1 + Math.exp(-3 * z)); // steeper logistic for clearer separation
  return Math.max(0.02, Math.min(0.98, p)); // clamp to [2%, 98%] so UI never shows 0/100
}

export default function MatchupCard({ homeId, awayId }: { homeId: number; awayId: number }) {
  const season = useMemo(() => nbaSeasonForEspn(), []);
  const seasontype = 2; // 2=regular, 1=pre, 3=post

  // standings (once)
  const { data: standings } = useSWR<StandPayload>(
    `/api/espn/standings?season=${season}&seasontype=${seasontype}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // last-5 (refresh occasionally)
  const { data: h5 } = useSWR<Recent>(
    `/api/espn/team/${homeId}/recent?season=${season}&seasontype=${seasontype}&limit=5`,
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: a5 } = useSWR<Recent>(
    `/api/espn/team/${awayId}/recent?season=${season}&seasontype=${seasontype}&limit=5`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const hStand = standings?.data?.[String(homeId)];
  const aStand = standings?.data?.[String(awayId)];

  // Season Win%
  const homeSeasonWP = (() => {
    if (!hStand) return 0.5;
    const w = Number(hStand.wins ?? 0);
    const l = Number(hStand.losses ?? 0);
    const t = w + l;
    return t > 0 ? w / t : 0.5;
  })();

  const awaySeasonWP = (() => {
    if (!aStand) return 0.5;
    const w = Number(aStand.wins ?? 0);
    const l = Number(aStand.losses ?? 0);
    const t = w + l;
    return t > 0 ? w / t : 0.5;
  })();

  // Last-5 Win%
  const homeLast5WP = (() => {
    if (!h5) return 0.5;
    const { w, l } = parseWL(h5.recordLastN);
    const t = w + l || h5.sample || 5;
    return t > 0 ? w / t : 0.5;
  })();

  const awayLast5WP = (() => {
    if (!a5) return 0.5;
    const { w, l } = parseWL(a5.recordLastN);
    const t = w + l || a5.sample || 5;
    return t > 0 ? w / t : 0.5;
  })();

  // PF-PA form (last 5)
  const homePFminusPA = (h5?.pfAvg ?? 0) - (h5?.paAvg ?? 0);
  const awayPFminusPA = (a5?.pfAvg ?? 0) - (a5?.paAvg ?? 0);

  const homeProb = computeHomeWinProb(
    homeSeasonWP, awaySeasonWP,
    homeLast5WP,  awayLast5WP,
    homePFminusPA, awayPFminusPA
  );
  const awayProb = 1 - homeProb;

  return (
    <div className="card">
      <div className="h2 mb-3">Matchup Snapshot</div>

      {/* Win probability bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1 text-sm">
          <span className="font-medium">Home Win Chance</span>
          <span className="mono">{(homeProb * 100).toFixed(0)}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-emerald-400/80 via-emerald-300/70 to-emerald-200/60"
            style={{ width: `${(homeProb * 100).toFixed(2)}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Away win chance: {(awayProb * 100).toFixed(0)}%
        </div>
      </div>

      {/* Two-column team facts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamBlock
          label="Home"
          rank={hStand?.confRank}
          rec={hStand ? `${hStand.wins}-${hStand.losses}` : undefined}
          pf={h5?.pfAvg}
          pa={h5?.paAvg}
          lastN={h5?.recordLastN}
        />
        <TeamBlock
          label="Away"
          rank={aStand?.confRank}
          rec={aStand ? `${aStand.wins}-${aStand.losses}` : undefined}
          pf={a5?.pfAvg}
          pa={a5?.paAvg}
          lastN={a5?.recordLastN}
        />
      </div>

      <p className="mono mt-3">
        Win% is a simple blend of season win%, last-5 win%, and PF-PA form with a small home-court bias.
      </p>
    </div>
  );
}

function TeamBlock(
  { label, rank, rec, pf, pa, lastN }:
  { label: string; rank?: number; rec?: string; pf?: number; pa?: number; lastN?: string }
) {
  return (
    <div>
      <div className="h3 font-semibold">{label}</div>
      <div className="mt-1 text-sm text-slate-300 flex flex-wrap gap-3">
        {rank ? <span className="badge">Conf Rank: {rank}</span> : null}
        {rec ? <span className="badge">Record: {rec}</span> : null}
        {typeof pf === "number" ? <span className="badge">PF (L5): {pf.toFixed(1)}</span> : null}
        {typeof pa === "number" ? <span className="badge">PA (L5): {pa.toFixed(1)}</span> : null}
        {lastN ? <span className="badge">Last 5: {lastN}</span> : null}
      </div>
    </div>
  );
}
