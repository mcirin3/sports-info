// src/lib/types.ts
export type TeamLite = { id: number; name: string; code: string; logo?: string };
export type GameLite = {
  id: number;
  date: string;
  season: number;
  status: string; // NS, Q1..Q4, OT, FT, AOT
  home: { team: TeamLite; score: number };
  away: { team: TeamLite; score: number };
};

export type OddsBookPrice = {
  bookmaker: string;
  market: "h2h" | "spreads" | "totals";
  label: string;
  price: number;
  point?: number;
};

export type GameOdds = {
  gameId: number;
  home: string;
  away: string;
  best: OddsBookPrice[];
};
