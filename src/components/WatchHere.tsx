"use client";

import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function WatchHere({
  sport,
  team,
  live,
}: {
  sport: string;
  team: string;
  live?: boolean;
}) {
  const teamName = (team ?? "").trim();
  const qs = new URLSearchParams({ sport, team: teamName }).toString();
  const { data, error, isLoading } = useSWR<{ url?: string; error?: string }>(
    `/api/watch?${qs}`,
    fetcher,
    { refreshInterval: live ? 15000 : 0 }
  );

  return (
    <div className="card">
      <div className="h2 mb-2">Watch here</div>

      {error ? (
        <p className="text-sm text-red-300">Failed to load link.</p>
      ) : isLoading ? (
        <p className="text-sm text-slate-300">Preparing stream…</p>
      ) : data?.url ? (
        <div className="flex items-center justify-between gap-3">
          <a
            className="btn"
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Stream
          </a>
          {live ? <LiveDot /> : <span className="badge">Not live yet</span>}
        </div>
      ) : (
        <p className="text-sm text-slate-300">No link configured.</p>
      )}
    </div>
  );
}

function LiveDot() {
  return (
    <span
      className="relative inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
      aria-label="Live"
      title="Live"
    >
      <span className="absolute inset-0 rounded-full animate-ping bg-red-500/60" />
    </span>
  );
}
