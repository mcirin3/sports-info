export default function About() {
    return (
      <main className="max-w-3xl space-y-6">
        <section className="card space-y-3">
          <h1 className="h1">About</h1>
          <p className="text-sm text-slate-200/90">
            NBA Scores & Odds is a lightweight web app that surfaces upcoming matchups,
            live scores, results, and a per-game page with best available odds and
            head-to-head (H2H) team context. It’s built with Next.js (App Router),
            TypeScript, and Tailwind, using a clean glass/gradient UI.
          </p>
        </section>
  
        <section className="card space-y-3">
          <h2 className="h2">Data Sources</h2>
          <ul className="list-disc pl-5 text-sm text-slate-200/90 space-y-1">
            <li>
              Fixtures / Live scores / Odds via API-Sports Basketball (proxied through
              server routes with caching).
            </li>
            <li>
              H2H snapshot is computed from recent season games (PPG, Opp PPG, pace-proxy).
            </li>
          </ul>
        </section>
  
        <section className="card space-y-3">
          <h2 className="h2">How it Works</h2>
          <ol className="list-decimal pl-5 text-sm text-slate-200/90 space-y-1">
            <li>
              The <span className="mono">/api/scores</span> route fetches fixtures and live
              states for a chosen date (or live=all).
            </li>
            <li>
              The <span className="mono">/api/odds</span> route normalizes bookmaker markets
              (moneyline, spreads, totals) and picks the best price per side.
            </li>
            <li>
              The <span className="mono">/api/h2h</span> route aggregates season-to-date team
              scoring and recent head-to-head results.
            </li>
          </ol>
        </section>
  
        <section className="card space-y-3">
          <h2 className="h2">Notes & Limitations</h2>
          <ul className="list-disc pl-5 text-sm text-slate-200/90 space-y-1">
            <li>
              Odds refresh every 30s on the game page; scores every 15s on the main board.
            </li>
            <li>
              Lines and availability vary by bookmaker and jurisdiction. Verify before betting.
            </li>
            <li>
              This project is for informational/educational use only and does not provide
              betting advice.
            </li>
          </ul>
        </section>
  
        <section className="card space-y-3">
          <h2 className="h2">Roadmap</h2>
          <ul className="list-disc pl-5 text-sm text-slate-200/90 space-y-1">
            <li>Bookmaker filters and “best price” badges per market.</li>
            <li>Expanded H2H: offensive/defensive ratings, shot profile, rebounding rates.</li>
            <li>Player prop pages (when enabled), with recent form and opponent context.</li>
          </ul>
        </section>
      </main>
    );
  }
  