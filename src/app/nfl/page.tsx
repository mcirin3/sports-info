"use client";
import useSWR from "swr";

type Team = { id:number; name:string; logo?:string };
type Game = {
  id:number; date:string; status:string; period?:number; clock?:string;
  home:{ team:Team; score:number }; away:{ team:Team; score:number };
  tv?: string[]; gameUrl?: string;
};
type Payload = { data: Game[] };

const TZ = "America/Chicago";
const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then(r=>r.json());

function todayYMDInTZ(tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-CA",{ timeZone:tz, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date());
  const y = parts.find(p=>p.type==="year")!.value, m = parts.find(p=>p.type==="month")!.value, d = parts.find(p=>p.type==="day")!.value;
  return `${y}-${m}-${d}`;
}
function tip(iso:string){ return new Intl.DateTimeFormat(undefined,{ timeZone:TZ, hour:"2-digit", minute:"2-digit"}).format(new Date(iso)); }

export default function NFLPage() {
  const date = todayYMDInTZ();
  const { data } = useSWR<Payload>(`/api/nfl/scores?date=${date}&tz=${encodeURIComponent(TZ)}`, fetcher, {
    refreshInterval: (latest)=> {
      const games = latest?.data ?? [];
      const live = games.some(g => ["Q1","Q2","Q3","Q4","OT"].includes(g.status));
      return live ? 5000 : 30000;
    },
    revalidateOnFocus: true, revalidateOnReconnect: true,
    isPaused: ()=> typeof document!=="undefined" && document.hidden,
  });

  const games = data?.data ?? [];
  const up = games.filter(g => g.status==="NS");
  const live = games.filter(g => ["Q1","Q2","Q3","Q4","OT"].includes(g.status));
  const fin = games.filter(g => g.status==="FT");

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="h1">NFL Scores</h1>
      </div>

      <Section title="Live" games={live} tipFn={tip} />
      <Section title="Upcoming" games={up} tipFn={tip} />
      <Section title="Final" games={fin} tipFn={tip} />
    </main>
  );
}

function Section({ title, games, tipFn }:{ title:string; games:Game[]; tipFn:(iso:string)=>string }) {
  if (!games.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="h2">{title}</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {games.map(g => <Card key={g.id} g={g} tipFn={tipFn} />)}
      </div>
    </section>
  );
}

function Card({ g, tipFn }:{ g:Game; tipFn:(iso:string)=>string }) {
  const isLive = ["Q1","Q2","Q3","Q4","OT"].includes(g.status);
  const badge = isLive ? `${g.status} • ${g.clock && g.clock !== "0:00" ? g.clock : "—"}` : g.status==="NS" ? tipFn(g.date) : "FT";
  const to = `/game/${g.id}?home=${g.home.team.id}&away=${g.away.team.id}`;
  return (
    <div className="card hover:bg-white/10 transition">
      <div className="badge flex items-center gap-2">
        {isLive && <LiveDot />}
        <span>{badge}</span>
      </div>
      <a href={to} className="block mt-2 no-underline">
        <Row t={g.away.team} s={g.away.score} />
        <Row t={g.home.team} s={g.home.score} />
      </a>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {g.tv?.slice(0,3).map((n,i)=><span key={i} className="badge">{n}</span>)}
        </div>
        {isLive && g.gameUrl ? (
          <a className="btn" href={g.gameUrl} target="_blank" rel="noopener noreferrer">Gamecast</a>
        ) : null}
      </div>
    </div>
  );
}

function Row({ t, s }:{ t:Team; s:number }) {
  return (
    <div className="mt-1 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {t.logo ? <img src={t.logo} alt="" className="w-6 h-6 rounded-full border border-white/10" /> : <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10" />}
        <span className="font-medium">{t.name}</span>
      </div>
      <span className="text-xl font-bold tabular-nums">{s ?? 0}</span>
    </div>
  );
}
function LiveDot(){
  return (
    <span className="relative inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]">
      <span className="absolute inset-0 rounded-full animate-ping bg-red-500/60" />
    </span>
  );
}
