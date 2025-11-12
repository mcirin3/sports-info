// app/api/odds/route.ts
import { NextResponse } from "next/server";
import { apis } from "@/lib/apisports";
import { GameOdds, OddsBookPrice } from "@/lib/types";
import { jsonError, toAmerican, num } from "@/lib/http";

export const dynamic = "force-dynamic";

type OddsResponse = Array<{
  game: { id: number };
  teams: { home: { name: string }; away: { name: string } };
  bookmakers: Array<{
    name: string;
    bets: Array<{
      name: string; // e.g., "Moneyline", "Handicap", "Totals"
      values: Array<{ value: string; odd: string; handicap?: string }>;
    }>;
  }>;
}>;

export async function GET() {
  try {
    const { response } = await apis<OddsResponse>("/odds", {
      league: 12,
      season: new Date().getFullYear(),
      page: 1,
    }, 30);

    const normalized: GameOdds[] = (response ?? []).map(o => {
      const prices: OddsBookPrice[] = [];

      for (const b of o.bookmakers ?? []) {
        for (const m of b.bets ?? []) {
          const key = m.name.toLowerCase();
          for (const v of m.values ?? []) {
            const american = toAmerican(v.odd);
            if (!american) continue;

            if (key.includes("moneyline") || key === "winner") {
              prices.push({ bookmaker: b.name, market: "h2h", label: v.value, price: american });
            } else if (key.includes("spread") || key.includes("handicap")) {
              prices.push({
                bookmaker: b.name,
                market: "spreads",
                label: v.value,
                price: american,
                point: num(v.handicap),
              });
            } else if (key.includes("total") || key.includes("over/under")) {
              prices.push({
                bookmaker: b.name,
                market: "totals",
                label: v.value,
                price: american,
                point: num(v.handicap),
              });
            }
          }
        }
      }

      // pick “best” by absolute price per (market, side, point)
      const bestMap = new Map<string, OddsBookPrice>();
      for (const p of prices) {
        const k = `${p.market}:${p.label}:${p.point ?? ""}`;
        const cur = bestMap.get(k);
        if (!cur || Math.abs(p.price) > Math.abs(cur.price)) bestMap.set(k, p);
      }

      return {
        gameId: o.game.id,
        home: o.teams.home.name,
        away: o.teams.away.name,
        best: Array.from(bestMap.values()),
      };
    });

    return NextResponse.json(normalized);
  } catch (e: any) {
    return jsonError(e?.message ?? "odds fetch failed", 500);
  }
}
