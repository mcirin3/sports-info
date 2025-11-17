import slugify from "slugify";

/**
 * Build a clean "https://{base}/{sport}/stream-{team}-live" URL.
 * Example:
 *   https://yourdomain.com/nba/stream-indiana-pacers-live
 */
export function buildWatchUrl(opts: {
  base: string;      // e.g. process.env.WATCH_BASE_URL
  sport: string;     // "nba"
  team?: string;     // "Indiana Pacers"
}) {
  const base = (opts.base || "").replace(/\/+$/, "");
  if (!base) return null;

  const sport = slugify(opts.sport, { lower: true });
  const teamSlug = slugify(opts.team ?? "", { lower: true });

  if (!teamSlug) {
    return `${base}/${sport}`;
  }

  return `${base}/${sport}/stream-${teamSlug}-live`;
}
